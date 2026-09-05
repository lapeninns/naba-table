import 'server-only';

import { z } from 'zod';

import { getServiceSupabaseClient } from '@/server/supabase';

import { buildIncidentKey } from './incidents';

import type { Incident, IncidentKey, IncidentStore } from './incidents';
import type { Json } from '@/types/supabase';

const identifier = z.string().regex(/^[A-Za-z0-9._:/-]{1,200}$/u);
const timestamp = z.string().datetime();
const incidentSchema = z
  .object({
    id: z.string().min(1).max(700),
    service: identifier,
    environment: identifier,
    failureClass: z
      .string()
      .regex(/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD):sha256:[a-f0-9]{64}$/u),
    severity: z.enum(['critical', 'warning']),
    status: z.enum(['open', 'acknowledged', 'escalated', 'resolved']),
    openedAt: timestamp,
    lastFailureAt: timestamp,
    lastObservedAt: timestamp,
    occurrenceCount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    updates: z
      .array(
        z
          .object({
            at: timestamp,
            kind: z.enum(['failure', 'healthy', 'acknowledged', 'escalated', 'resolved']),
            note: z.literal('error-insight').optional(),
          })
          .strict(),
      )
      .max(100),
    summarizedFailures: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    owner: identifier.nullable(),
    acknowledgedAt: timestamp.nullable(),
    acknowledgedBy: identifier.nullable(),
    escalatedAt: timestamp.nullable(),
    resolvedAt: timestamp.nullable(),
    consecutiveHealthy: z.number().int().nonnegative(),
  })
  .strict();
const snapshotSchema = z
  .object({
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    incident: incidentSchema,
  })
  .strict()
  .nullable();

export interface IncidentPersistence {
  read(key: string): Promise<unknown>;
  compareAndSwap(key: string, expectedVersion: number, incident: Incident): Promise<boolean>;
}

function supabasePersistence(): IncidentPersistence {
  // A service-role RPC is required. There is no in-memory fallback on errors.
  const client = getServiceSupabaseClient();
  return {
    async read(key) {
      const { data, error } = await client.rpc('read_operational_incident', { p_key: key });
      if (error) throw new Error('Incident persistence unavailable');
      return data;
    },
    async compareAndSwap(key, expectedVersion, incident) {
      const { data, error } = await client.rpc('compare_and_swap_operational_incident', {
        p_key: key,
        p_expected_version: expectedVersion,
        p_incident: incidentSchema.parse(incident) as Json,
      });
      if (error || typeof data !== 'boolean') throw new Error('Incident persistence unavailable');
      return data;
    },
  };
}

function validateSnapshot(value: unknown, key: IncidentKey) {
  const snapshot = snapshotSchema.parse(value);
  if (snapshot && buildIncidentKey(snapshot.incident) !== buildIncidentKey(key)) {
    throw new Error('Incident persistence key mismatch');
  }
  return snapshot;
}

export function createSupabaseIncidentStore(
  persistence: IncidentPersistence = supabasePersistence(),
): IncidentStore {
  return {
    async getActive(key) {
      const snapshot = validateSnapshot(await persistence.read(buildIncidentKey(key)), key);
      return snapshot?.incident.status === 'resolved' ? null : (snapshot?.incident ?? null);
    },
    async update(key, reduce) {
      const storageKey = buildIncidentKey(key);
      for (let attempt = 0; attempt < 32; attempt += 1) {
        const snapshot = validateSnapshot(await persistence.read(storageKey), key);
        const current =
          snapshot?.incident.status === 'resolved' ? null : (snapshot?.incident ?? null);
        const outcome = reduce(current);
        if (!outcome) return null;
        const incident = incidentSchema.parse(outcome.incident);
        if (buildIncidentKey(incident) !== storageKey)
          throw new Error('Incident persistence key mismatch');
        if (await persistence.compareAndSwap(storageKey, snapshot?.version ?? 0, incident)) {
          return { ...outcome, incident };
        }
        // Re-read and reapply the pure reducer; never emit an uncommitted transition.
      }
      throw new Error('Incident persistence contention limit reached');
    },
  };
}

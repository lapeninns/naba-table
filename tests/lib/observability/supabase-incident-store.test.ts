import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { recordErrorInsightIncident } from '@/lib/observability/error-insight';
import { recordFailureObservation, recordHealthyObservation } from '@/lib/observability/incidents';
import { createSupabaseIncidentStore } from '@/lib/observability/supabase-incident-store';

import type { Incident, IncidentKey } from '@/lib/observability/incidents';
import type { IncidentPersistence } from '@/lib/observability/supabase-incident-store';

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: vi.fn(() => {
    throw new Error('Missing database configuration');
  }),
}));

const key: IncidentKey = {
  service: 'nabatable-web',
  environment: 'staging',
  failureClass: `GET:sha256:${'a'.repeat(64)}`,
};
const start = new Date('2026-09-05T11:00:00.000Z');
const observation = (at = start) => ({
  ...key,
  severity: 'critical' as const,
  observedAt: at,
  note: 'error-insight',
});

function sharedPersistence() {
  const rows = new Map<string, { version: number; incident: Incident }>();
  const persistence: IncidentPersistence = {
    async read(storageKey) {
      return structuredClone(rows.get(storageKey) ?? null);
    },
    async compareAndSwap(storageKey, expectedVersion, incident) {
      const row = rows.get(storageKey);
      if ((row?.version ?? 0) !== expectedVersion) return false;
      rows.set(storageKey, { version: expectedVersion + 1, incident: structuredClone(incident) });
      return true;
    },
  };
  return { persistence, rows };
}

describe('durable incident compare-and-swap adapter', () => {
  it('counts concurrent observations across independent instances with one opener', async () => {
    const { persistence, rows } = sharedPersistence();
    const outcomes = await Promise.all(
      Array.from({ length: 20 }, () =>
        recordFailureObservation(createSupabaseIncidentStore(persistence), observation()),
      ),
    );
    expect(outcomes.filter((outcome) => outcome.transition === 'opened')).toHaveLength(1);
    expect(new Set(outcomes.map((outcome) => outcome.incident.id)).size).toBe(1);
    expect([...rows.values()][0]).toMatchObject({
      version: 20,
      incident: { occurrenceCount: 20, summarizedFailures: 10 },
    });
    expect(outcomes.filter((outcome) => outcome.transition === 'suppressed')).toHaveLength(10);
    await expect(createSupabaseIncidentStore(persistence).getActive(key)).resolves.toMatchObject({
      occurrenceCount: 20,
    });
  });

  it('persists hashed failure classes without raw request or provider metadata', async () => {
    const { persistence, rows } = sharedPersistence();
    await recordErrorInsightIncident({
      insight: {
        service: 'nabatable-web',
        traceId: 'private-trace',
        deploySha: 'private-deploy',
        requestId: 'private-request',
        method: 'GET',
        path: '/guest/private-identifier',
        fingerprint: 'private-fingerprint',
      },
      environment: 'staging',
      severity: 'critical',
      observedAt: start,
      store: createSupabaseIncidentStore(persistence),
    });
    const serialized = JSON.stringify([...rows.values()]);
    expect(serialized).not.toContain('private');
    expect([...rows.values()][0]?.incident.failureClass).toMatch(/^GET:sha256:[a-f0-9]{64}$/);
  });

  it('emits a single committed escalation under concurrent retries', async () => {
    const { persistence, rows } = sharedPersistence();
    await recordFailureObservation(createSupabaseIncidentStore(persistence), observation());
    const later = new Date(start.getTime() + 16 * 60_000);
    const outcomes = await Promise.all(
      Array.from({ length: 12 }, () =>
        recordFailureObservation(createSupabaseIncidentStore(persistence), observation(later)),
      ),
    );
    expect(outcomes.filter((outcome) => outcome.transition === 'escalated')).toHaveLength(1);
    expect(
      [...rows.values()][0]?.incident.updates.filter((update) => update.kind === 'escalated'),
    ).toHaveLength(1);
    expect([...rows.values()][0]?.incident.occurrenceCount).toBe(13);
  });

  it('retains versions across resolution and refuses stale writes after reopening', async () => {
    const { persistence, rows } = sharedPersistence();
    const store = createSupabaseIncidentStore(persistence);
    const opened = await recordFailureObservation(store, observation());
    for (let index = 0; index < 3; index += 1)
      await recordHealthyObservation(store, { ...key, observedAt: start });
    await expect(store.getActive(key)).resolves.toBeNull();
    expect([...rows.values()][0]?.version).toBe(4);
    const reopened = await recordFailureObservation(
      createSupabaseIncidentStore(persistence),
      observation(new Date(start.getTime() + 60_000)),
    );
    expect(reopened.transition).toBe('opened');
    expect([...rows.values()][0]?.version).toBe(5);
    expect(await persistence.compareAndSwap([...rows.keys()][0]!, 1, opened.incident)).toBe(false);
    expect([...rows.values()][0]?.incident.id).toBe(reopened.incident.id);
  });

  it('fails closed after bounded contention', async () => {
    const compareAndSwap = vi.fn().mockResolvedValue(false);
    const store = createSupabaseIncidentStore({ read: async () => null, compareAndSwap });
    await expect(recordFailureObservation(store, observation())).rejects.toThrow(
      'contention limit',
    );
    expect(compareAndSwap).toHaveBeenCalledTimes(32);
  });

  it('does not fall back to memory when configuration or persistence is unavailable', async () => {
    expect(() => createSupabaseIncidentStore()).toThrow('Missing database configuration');
    const compareAndSwap = vi.fn();
    const store = createSupabaseIncidentStore({
      read: async () => {
        throw new Error('unavailable');
      },
      compareAndSwap,
    });
    await expect(recordFailureObservation(store, observation())).rejects.toThrow('unavailable');
    expect(compareAndSwap).not.toHaveBeenCalled();
  });

  it('rejects corrupted or cross-key snapshots before mutation', async () => {
    const { persistence, rows } = sharedPersistence();
    await recordFailureObservation(createSupabaseIncidentStore(persistence), observation());
    const snapshot = [...rows.values()][0]!;
    for (const value of [
      { version: -1, incident: snapshot.incident },
      { ...snapshot, incident: { ...snapshot.incident, environment: 'production' } },
      { ...snapshot, incident: { ...snapshot.incident, providerPayload: 'private' } },
    ]) {
      const compareAndSwap = vi.fn();
      const store = createSupabaseIncidentStore({ read: async () => value, compareAndSwap });
      await expect(recordFailureObservation(store, observation())).rejects.toThrow();
      expect(compareAndSwap).not.toHaveBeenCalled();
    }
  });

  it('restricts SQL access to service-role RPCs with atomic version predicates and no deletion', () => {
    const sql = readFileSync(
      'supabase/migrations/20260905113000_durable_operational_incidents.sql',
      'utf8',
    );
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('from public, anon, authenticated, service_role');
    expect(sql.match(/set search_path = pg_catalog/g)).toHaveLength(2);
    expect(sql.match(/grant execute .* to service_role;/g)).toHaveLength(2);
    expect(sql).toContain('on conflict (incident_key) do nothing');
    expect(sql).toContain('where incident_key = p_key and version = p_expected_version');
    expect(sql).toContain('version = version + 1');
    expect(sql).not.toMatch(/delete from|truncate|create policy/i);
  });
});

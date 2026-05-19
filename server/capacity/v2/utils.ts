import { createHash } from 'node:crypto';

import type { VenuePolicy } from '../policy';

function stableJson(value: unknown): string {
  return JSON.stringify(toStableJsonValue(value));
}

function toStableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toStableJsonValue);
  }

  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = toStableJsonValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return value;
}

/**
 * Returns a lexicographically sorted array of unique table ids.
 */
export function normalizeTableIds(tableIds: string[]): string[] {
  return Array.from(new Set(tableIds)).sort((a, b) => a.localeCompare(b));
}

type PlanSignatureInput = {
  bookingId: string;
  tableIds: string[];
  startAt: string;
  endAt: string;
  salt?: string;
};

/**
 * Deterministically derives a short signature for a plan based on booking scope
 * and assignment window. Used for idempotency and telemetry correlation.
 */
export function createPlanSignature(input: PlanSignatureInput): string {
  const normalizedTableIds = normalizeTableIds(input.tableIds);
  const hash = createHash('sha256');

  hash.update(input.bookingId);
  hash.update('|');
  hash.update(normalizedTableIds.join(','));
  hash.update('|');
  hash.update(input.startAt);
  hash.update('|');
  hash.update(input.endAt);

  if (input.salt) {
    hash.update('|');
    hash.update(input.salt);
  }

  return hash.digest('hex').slice(0, 16);
}

export function hashPolicyVersion(policy: VenuePolicy): string {
  const hash = createHash('sha256');
  hash.update(
    stableJson({
      timezone: policy.timezone,
      serviceOrder: policy.serviceOrder,
      services: policy.services,
      turnBandsByOption: policy.turnBandsByOption ?? null,
    }),
  );
  return hash.digest('hex').slice(0, 16);
}

export function createDeterministicIdempotencyKey(input: {
  tenantId: string;
  bookingId: string;
  tableIds: string[];
  startAt: string;
  endAt: string;
  policyVersion: string;
}): string {
  const normalizedTableIds = normalizeTableIds(input.tableIds);
  const hash = createHash('sha256');
  hash.update(input.tenantId);
  hash.update('|');
  hash.update(input.bookingId);
  hash.update('|');
  hash.update(normalizedTableIds.join(','));
  hash.update('|');
  hash.update(input.startAt);
  hash.update('|');
  hash.update(input.endAt);
  hash.update('|');
  hash.update(input.policyVersion);
  return hash.digest('hex').slice(0, 24);
}

export function computePayloadChecksum(payload: unknown): string {
  const hash = createHash('sha256');
  hash.update(stableJson(payload));
  return hash.digest('hex');
}

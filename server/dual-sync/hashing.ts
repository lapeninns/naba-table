/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Deterministic SHA-256 over canonical-JSON hashing helpers used by field
 * states, snapshot runs, outbound candidates, and publish operations.
 *
 * Algorithm parity with the legacy V2 hasher (`server/google-business-profile-v2/hashing.ts`)
 * is intentional: the same canonical payload must hash to the same hex
 * digest in both modules so cross-validation during the rollout window is
 * cheap. This module is a clean reimplementation rather than a re-export
 * to keep the dual-sync namespace fully self-contained.
 */

import { createHash } from 'node:crypto';

function stableStringify(value: unknown): string {
  if (value === undefined || value === null) {
    return 'null';
  }
  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`,
  );
  return `{${entries.join(',')}}`;
}

/**
 * SHA-256 hex digest over the canonical JSON form of `value`. Stable across
 * platforms and across object key ordering. Returns `null` for `null` /
 * `undefined` values so callers can express "field is absent" symmetrically
 * for both Core and Google sides.
 */
export function hashCanonicalJson(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

/**
 * Hash a list of section snapshots into one whole-side snapshot hash.
 * Sorts by `sectionKey` to make the result order-independent.
 */
export function hashSectionSnapshots(
  sections: ReadonlyArray<{ readonly sectionKey: string; readonly hash: string | null }>,
): string {
  const sorted = [...sections].sort((left, right) =>
    left.sectionKey < right.sectionKey ? -1 : left.sectionKey > right.sectionKey ? 1 : 0,
  );
  return (
    createHash('sha256')
      .update(
        stableStringify(
          sorted.map(({ sectionKey, hash }) => ({ sectionKey, hash: hash ?? null })),
        ),
      )
      .digest('hex')
  );
}

/** Internal export reserved for unit tests. */
export const __testing = { stableStringify } as const;

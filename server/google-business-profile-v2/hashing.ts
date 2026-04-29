/**
 * Phase 1 of the GBP Dual-Sync V2 architecture.
 *
 * Deterministic SHA-256 over canonical-JSON hashing helpers used by V2
 * snapshots, diff items, decisions, and frozen publish-job contracts.
 *
 * Algorithm parity with legacy `server/google-business-profile/workflow.ts`
 * (`stableStringify` + `hashJson`) is intentional so that V2 hashes for the
 * same canonical payload are byte-for-byte equal to legacy hashes. This makes
 * the parallel-validation step in Phase 6 cheap and unambiguous.
 *
 * One deliberate divergence: the legacy helper crashes on a top-level
 * `undefined` because `JSON.stringify(undefined) === undefined`. V2 coerces
 * `undefined` to canonical `null` instead. This is safe for parity because
 * real legacy payloads never hash a top-level `undefined`; the value passes
 * through `core-normalization` first.
 */

import { createHash } from 'node:crypto';

function stableStringify(value: unknown): string {
  // Treat `undefined` as canonical absent (`null`) so the hasher cannot crash
  // on partially-populated section payloads. `JSON.stringify(undefined)`
  // returns the literal `undefined` value, not a string.
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
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(',')}}`;
}

/**
 * SHA-256 hex digest over the canonical JSON form of `value`. Stable across
 * platforms and across object key ordering.
 */
export function hashCanonicalJson(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

/**
 * Hash a list of section snapshots into one whole-side snapshot hash. Order
 * is taken from the input — callers MUST sort by `sectionKey` before passing
 * if they want order-independent equality.
 */
export function hashSectionSnapshots(
  sections: ReadonlyArray<{ readonly sectionKey: string; readonly hash: string }>,
): string {
  return hashCanonicalJson(sections.map(({ sectionKey, hash }) => ({ sectionKey, hash })));
}

/**
 * Hash a frozen decision set for the publish-job contract lock. Sorts by
 * `(sectionKey, fieldKey)` to ensure callers cannot trick the lock by
 * reordering the same logical decisions.
 */
export function hashFrozenDecisions(
  decisions: ReadonlyArray<{
    readonly sectionKey: string;
    readonly fieldKey: string;
    readonly action: string;
    readonly nabatableValueHash: string;
    readonly googleValueHash: string;
  }>,
): string {
  const sorted = [...decisions].sort((left, right) => {
    if (left.sectionKey !== right.sectionKey) {
      return left.sectionKey < right.sectionKey ? -1 : 1;
    }
    return left.fieldKey < right.fieldKey ? -1 : left.fieldKey > right.fieldKey ? 1 : 0;
  });
  return hashCanonicalJson(sorted);
}

/** Internal export kept for V2 unit tests only. */
export const __testing = { stableStringify } as const;

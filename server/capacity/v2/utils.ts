import { createHash } from "node:crypto";

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
  const hash = createHash("sha256");

  hash.update(input.bookingId);
  hash.update("|");
  hash.update(normalizedTableIds.join(","));
  hash.update("|");
  hash.update(input.startAt);
  hash.update("|");
  hash.update(input.endAt);

  if (input.salt) {
    hash.update("|");
    hash.update(input.salt);
  }

  return hash.digest("hex").slice(0, 16);
}

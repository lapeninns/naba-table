import type { ReservationDraft } from '../model/reducer';

/** A retryable create conflict is retried once, with the same idempotency key. */
export const CREATE_CONFLICT_MAX_RETRIES = 1;
export const CREATE_CONFLICT_DEFAULT_RETRY_DELAY_MS = 1_000;
export const CREATE_CONFLICT_MAX_RETRY_DELAY_MS = 5_000;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Delay before retrying a create that failed with a transient `409 BOOKING_CONFLICT`
 * (`retryable: true`), or null when the error must not be retried. Reads both the reserve
 * api client error (`{ status, code, body }`) and the shared `HttpError` (`fetchJson`).
 */
export function getRetryableConflictDelayMs(error: unknown): number | null {
  const record = asRecord(error);
  if (!record || record.status !== 409) return null;

  const body = asRecord(record.body);
  const code = typeof record.code === 'string' ? record.code : body?.code;
  if (code !== 'BOOKING_CONFLICT') return null;

  const retryable = record.retryable === true || body?.retryable === true;
  if (!retryable) return null;

  const retryAfterSeconds = readNumber(record.retryAfter) ?? readNumber(body?.retryAfter);
  if (retryAfterSeconds === null) return CREATE_CONFLICT_DEFAULT_RETRY_DELAY_MS;
  return Math.min(Math.max(retryAfterSeconds, 0) * 1_000, CREATE_CONFLICT_MAX_RETRY_DELAY_MS);
}

export function shouldRetryCreateConflict(failureCount: number, error: unknown): boolean {
  return failureCount < CREATE_CONFLICT_MAX_RETRIES && getRetryableConflictDelayMs(error) !== null;
}

export function createConflictRetryDelay(_failureCount: number, error: unknown): number {
  return getRetryableConflictDelayMs(error) ?? CREATE_CONFLICT_DEFAULT_RETRY_DELAY_MS;
}

/**
 * Identity of one booking intent. The idempotency key is reused while the fingerprint is
 * unchanged (retries, double clicks) and replaced when the guest edits the booking, so an
 * edited draft never collides with the earlier attempt's key (409 IDEMPOTENCY_KEY_REUSED).
 */
export function reservationDraftFingerprint(draft: ReservationDraft, bookingId?: string): string {
  return JSON.stringify([
    bookingId ?? null,
    draft.restaurantId ?? null,
    draft.restaurantSlug ?? null,
    draft.date,
    draft.time,
    draft.party,
    draft.bookingType,
    draft.name,
    draft.email ?? null,
    draft.phone ?? null,
    draft.notes ?? null,
    draft.marketingOptIn,
    draft.whatsappOptIn,
  ]);
}

export type CreateIntentKeyStore = {
  /** The key for this draft fingerprint; `isNew` when the previous intent was replaced. */
  resolve(fingerprint: string): { key: string; isNew: boolean };
  clear(): void;
};

/**
 * Holds the current booking intent's key outside React state, so a wizard step that remounts
 * (for example after a timeout) resubmits the same draft with the same key and gets a key
 * replay instead of a new intent. One store per create hook module; cleared on success and
 * on terminal errors.
 */
export function createIntentKeyStore(generateKey: () => string): CreateIntentKeyStore {
  let current: { fingerprint: string; key: string } | null = null;
  return {
    resolve(fingerprint) {
      if (current?.fingerprint === fingerprint) {
        return { key: current.key, isNew: false };
      }
      current = { fingerprint, key: generateKey() };
      return { key: current.key, isNew: true };
    },
    clear() {
      current = null;
    },
  };
}

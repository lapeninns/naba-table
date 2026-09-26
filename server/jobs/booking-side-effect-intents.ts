import { logger } from '@/lib/logger';

import type { EmailJobType } from '@/server/queue/email-contract';
import type { Database, Tables } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Durable, idempotent booking email intents (table `email_dispatch_intents`).
 *
 * - `ensureBookingEmailIntent` writes an intent only when its dedupe key is absent
 *   (RPC `ensure_booking_email_intent`, INSERT ... ON CONFLICT DO NOTHING). Calling
 *   it again on a create replay never resets a sent or processing intent.
 * - `claimBookingEmailIntent` + `settleBookingEmailIntent` let a request send an
 *   intent inline without racing the `/api/cron/process-emails` drain: the claim is
 *   one conditional UPDATE, so exactly one caller owns an attempt. A failed inline
 *   attempt goes back to `pending` and the cron drain retries it.
 *
 * None of these functions throw: failures are logged (no PII) and returned.
 */

type IntentClient = Pick<SupabaseClient<Database, 'public'>, 'rpc'>;

type EmailIntentRow = Tables<'email_dispatch_intents'>;

const EMAIL_INTENT_KEY_SEPARATOR = '__';

/**
 * Dedupe key for a booking email intent. Matches the default key used by
 * `scheduleEmailIntent` (`email__<type>__<bookingId>`), so a confirmation written
 * here and one written by the queue module can never both exist.
 */
export function bookingEmailIntentKey(
  type: EmailJobType,
  bookingId: string,
  discriminator?: string | null,
): string {
  const parts = ['email', type, bookingId];
  if (discriminator) {
    parts.push(discriminator);
  }
  return parts.join(EMAIL_INTENT_KEY_SEPARATOR).replace(/:/g, EMAIL_INTENT_KEY_SEPARATOR);
}

function errorCodeOf(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }
  return 'UNKNOWN';
}

export type EnsureBookingEmailIntentResult =
  | { ok: true; intentId: string; created: boolean; status: string }
  | { ok: false; errorCode: string };

export async function ensureBookingEmailIntent(
  client: IntentClient,
  params: {
    bookingId: string;
    restaurantId: string;
    type: EmailJobType;
    dedupeKey: string;
    scheduledFor?: string | null;
    /**
     * Also cancel this booking's other still-pending intents of these types (same
     * statement). Used by modification emails so only the latest one is sent.
     */
    supersedeTypes?: readonly EmailJobType[];
  },
): Promise<EnsureBookingEmailIntentResult> {
  try {
    const { data, error } = await client.rpc('ensure_booking_email_intent', {
      p_booking_id: params.bookingId,
      p_restaurant_id: params.restaurantId,
      p_email_type: params.type,
      p_dedupe_key: params.dedupeKey,
      p_scheduled_for: params.scheduledFor ?? null,
      p_supersede_types: params.supersedeTypes?.length ? [...params.supersedeTypes] : null,
    });
    if (error) {
      throw error;
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      throw Object.assign(new Error('ensure_booking_email_intent returned no row'), {
        code: 'NO_ROW',
      });
    }
    return { ok: true, intentId: row.intent_id, created: row.created, status: row.intent_status };
  } catch (error) {
    const errorCode = errorCodeOf(error);
    logger.error('[jobs][email-intent] ensure failed', {
      bookingId: params.bookingId,
      restaurantId: params.restaurantId,
      emailType: params.type,
      errorCode,
    });
    return { ok: false, errorCode };
  }
}

export type ClaimBookingEmailIntentResult =
  | { ok: true; intent: EmailIntentRow | null }
  | { ok: false; errorCode: string };

export async function claimBookingEmailIntent(
  client: IntentClient,
  params: { dedupeKey: string; restaurantId: string },
): Promise<ClaimBookingEmailIntentResult> {
  try {
    const { data, error } = await client.rpc('claim_booking_email_intent', {
      p_dedupe_key: params.dedupeKey,
      p_restaurant_id: params.restaurantId,
    });
    if (error) {
      throw error;
    }
    return { ok: true, intent: Array.isArray(data) && data[0] ? data[0] : null };
  } catch (error) {
    const errorCode = errorCodeOf(error);
    logger.error('[jobs][email-intent] claim failed', {
      restaurantId: params.restaurantId,
      errorCode,
    });
    return { ok: false, errorCode };
  }
}

export async function settleBookingEmailIntent(
  client: IntentClient,
  params: {
    intentId: string;
    restaurantId: string;
    /**
     * claim_generation returned by the claim (monotonic, never reset): the settle only
     * matches that claim. Null when migration 20260927210000 is not applied yet; the
     * settle then falls back to the weaker attempts_made fence.
     */
    claimGeneration: number | null;
    /** attempts_made returned by the claim: the fallback fence. */
    expectedAttempts: number;
    outcome: 'sent' | 'skipped' | 'retry';
    errorCode?: string | null;
    retryDelaySeconds?: number;
  },
): Promise<string | null> {
  try {
    const shared = {
      p_intent_id: params.intentId,
      p_restaurant_id: params.restaurantId,
      p_outcome: params.outcome,
      p_error_code: params.errorCode ?? null,
      p_retry_delay_seconds: params.retryDelaySeconds ?? 60,
    };
    const { data, error } =
      params.claimGeneration !== null
        ? await client.rpc('settle_booking_email_intent_v2', {
            ...shared,
            p_claim_generation: params.claimGeneration,
          })
        : await client.rpc('settle_booking_email_intent', {
            ...shared,
            p_expected_attempts: params.expectedAttempts,
          });
    if (error) {
      throw error;
    }
    if (typeof data !== 'string') {
      // No row matched: the intent was re-claimed (lease expired or reset), cancelled
      // or already settled.
      logger.warn('[jobs][email-intent] settle matched no claim', {
        intentId: params.intentId,
        outcome: params.outcome,
      });
      return null;
    }
    return data;
  } catch (error) {
    // The intent stays 'processing'; claim_due_email_dispatch_intents re-claims it
    // after its 15 minute lease, so it is still retried.
    logger.error('[jobs][email-intent] settle failed', {
      intentId: params.intentId,
      outcome: params.outcome,
      errorCode: errorCodeOf(error),
    });
    return null;
  }
}

export type InlineEmailIntentOutcome =
  | 'sent'
  | 'skipped'
  | 'not_claimed'
  | 'retry_scheduled'
  | 'claim_failed';

/**
 * Claims one intent and runs `send` for it inline. `not_claimed` means another
 * caller owns it or it is already settled (sent, skipped, cancelled, failed), which
 * is what makes a replay safe. A throwing `send` leaves the intent retryable by the
 * queue and never propagates.
 */
export async function runClaimedBookingEmailIntent(
  client: IntentClient,
  params: {
    dedupeKey: string;
    restaurantId: string;
    bookingId: string;
    retryDelaySeconds?: number;
  },
  send: () => Promise<'sent' | 'skipped'>,
): Promise<InlineEmailIntentOutcome> {
  const claim = await claimBookingEmailIntent(client, params);
  if (!claim.ok) {
    return 'claim_failed';
  }
  if (!claim.intent) {
    return 'not_claimed';
  }

  const intentId = claim.intent.id;
  // Fencing token: if this attempt outlives its 15 minute lease, or the intent is reset
  // and re-claimed, claim_generation moves on and this settle matches nothing.
  // attempts_made is the fallback fence before migration 20260927210000.
  const claimGeneration =
    typeof claim.intent.claim_generation === 'number' ? claim.intent.claim_generation : null;
  const expectedAttempts = claim.intent.attempts_made;
  let outcome: 'sent' | 'skipped';
  try {
    outcome = await send();
  } catch (error) {
    logger.warn('[jobs][email-intent] inline send failed; left for the queue', {
      bookingId: params.bookingId,
      intentId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    await settleBookingEmailIntent(client, {
      intentId,
      restaurantId: params.restaurantId,
      claimGeneration,
      expectedAttempts,
      outcome: 'retry',
      errorCode: 'INLINE_SEND_FAILED',
      retryDelaySeconds: params.retryDelaySeconds,
    });
    return 'retry_scheduled';
  }

  await settleBookingEmailIntent(client, {
    intentId,
    restaurantId: params.restaurantId,
    claimGeneration,
    expectedAttempts,
    outcome,
  });
  return outcome;
}

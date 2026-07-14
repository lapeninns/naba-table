import 'server-only';

import { dispatchBookingReviewWhatsApp } from '@/server/notifications/booking-whatsapp-content';
import { finalizeMobileWhatsAppAttempt } from '@/server/notifications/mobile';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { BookingRecord } from '@/server/bookings';
import type { MobileAttemptStatus, MobileDispatchResult } from '@/server/notifications/mobile';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type MobileIntentClient = Pick<SupabaseClient<Database>, 'rpc'>;
type MobileReviewIntent = Database['public']['Tables']['mobile_notifications']['Row'];
type IntentStatus = 'pending' | 'processed' | 'skipped' | 'failed';
type IntentResolution = {
  readonly attemptFinalization?: {
    readonly attemptId: string;
    readonly errorCode: string | null;
    readonly providerMessageId: string | null;
    readonly status: MobileAttemptStatus;
  };
  readonly errorCode: string | null;
  readonly status: IntentStatus;
};

const MAX_INTENT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000;

class MobileReviewIntentClaimLostError extends Error {
  constructor() {
    super('Mobile review intent claim ownership was lost.');
    this.name = 'MobileReviewIntentClaimLostError';
  }
}

export async function scheduleMobileReviewIntent(params: {
  readonly booking: BookingRecord;
  readonly client?: MobileIntentClient;
  readonly restaurantId: string;
  readonly scheduledFor: string;
}): Promise<string | null> {
  const client = params.client ?? getServiceSupabaseClient();
  const { data, error } = await client.rpc('schedule_mobile_review_notification', {
    p_booking_id: params.booking.id,
    p_recipient_phone: params.booking.whatsapp_consent_phone ?? '',
    p_restaurant_id: params.restaurantId,
    p_scheduled_for: params.scheduledFor,
  });
  if (error) {
    throw new Error('Failed to schedule mobile review notification.');
  }
  return data;
}

export type MobileReviewDrainSummary = {
  readonly processed: number;
  readonly sent: number;
  readonly skipped: number;
  readonly failed: number;
};

async function updateIntent(
  client: SupabaseClient<Database>,
  intent: MobileReviewIntent,
  resolution: IntentResolution,
): Promise<void> {
  if (!intent.mobile_intent_claim_token) {
    throw new Error('Claimed mobile review intent has no ownership token.');
  }
  const retrying = resolution.status === 'pending';
  const { data, error } = await client
    .from('mobile_notifications')
    .update({
      ...(resolution.attemptFinalization
        ? {
            mobile_intent_attempt_error_code: resolution.attemptFinalization.errorCode,
            mobile_intent_attempt_id: resolution.attemptFinalization.attemptId,
            mobile_intent_attempt_status: resolution.attemptFinalization.status,
            mobile_intent_provider_message_id: resolution.attemptFinalization.providerMessageId,
          }
        : {}),
      mobile_intent_claimed_at: null,
      mobile_intent_claim_token: null,
      mobile_intent_last_error: resolution.errorCode,
      mobile_intent_processed_at: retrying ? null : new Date().toISOString(),
      mobile_intent_scheduled_for: retrying
        ? new Date(Date.now() + RETRY_DELAY_MS).toISOString()
        : intent.mobile_intent_scheduled_for,
      mobile_intent_status: resolution.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', intent.id)
    .eq('restaurant_id', intent.restaurant_id)
    .eq('mobile_intent_status', 'claimed')
    .eq('mobile_intent_claim_token', intent.mobile_intent_claim_token)
    .select('id')
    .maybeSingle();
  if (error) {
    throw new Error('Failed to finalize mobile review intent.');
  }
  if (!data) {
    throw new MobileReviewIntentClaimLostError();
  }
}

function resolveDispatchResult(result: MobileDispatchResult): IntentResolution {
  switch (result.kind) {
    case 'whatsapp_accepted':
      return {
        attemptFinalization: {
          attemptId: result.attemptId,
          errorCode: null,
          providerMessageId: result.providerMessageId,
          status: result.status,
        },
        errorCode: null,
        status: 'processed',
      };
    case 'ineligible':
      return { errorCode: 'REVIEW_WHATSAPP_INELIGIBLE', status: 'skipped' };
    case 'duplicate':
      return { errorCode: 'REVIEW_WHATSAPP_DUPLICATE', status: 'skipped' };
    case 'provider_attempt_failed':
      return { errorCode: 'REVIEW_WHATSAPP_PROVIDER_ATTEMPT_FAILED', status: 'failed' };
    case 'attempt_finalization_pending':
      return {
        attemptFinalization: {
          attemptId: result.attemptId,
          errorCode: result.errorCode,
          providerMessageId: result.providerMessageId,
          status: result.status,
        },
        errorCode: 'REVIEW_WHATSAPP_ATTEMPT_FINALIZATION_PENDING',
        status: 'pending',
      };
    case 'sms':
      return { errorCode: 'REVIEW_WHATSAPP_UNEXPECTED_SMS', status: 'failed' };
  }
}

function isMobileAttemptStatus(value: string | null): value is MobileAttemptStatus {
  return (
    value === 'claimed' ||
    value === 'accepted' ||
    value === 'queued' ||
    value === 'sent' ||
    value === 'delivered' ||
    value === 'read' ||
    value === 'undelivered' ||
    value === 'failed'
  );
}

async function finalizePendingAttempt(
  intent: MobileReviewIntent,
): Promise<IntentResolution | null> {
  if (!intent.mobile_intent_attempt_id && !intent.mobile_intent_attempt_status) {
    return null;
  }
  if (
    !intent.mobile_intent_attempt_id ||
    !isMobileAttemptStatus(intent.mobile_intent_attempt_status)
  ) {
    throw new Error('Mobile review intent has an invalid attempt finalization payload.');
  }
  const status = await finalizeMobileWhatsAppAttempt({
    attemptId: intent.mobile_intent_attempt_id,
    errorCode: intent.mobile_intent_attempt_error_code,
    providerMessageId: intent.mobile_intent_provider_message_id,
    status: intent.mobile_intent_attempt_status,
  });
  return status === 'failed' || status === 'undelivered'
    ? { errorCode: 'REVIEW_WHATSAPP_PROVIDER_ATTEMPT_FAILED', status: 'failed' }
    : { errorCode: null, status: 'processed' };
}

async function fetchIntentBooking(
  client: SupabaseClient<Database>,
  intent: MobileReviewIntent,
): Promise<BookingRecord | null> {
  if (!intent.booking_id) {
    return null;
  }
  const { data, error } = await client
    .from('bookings')
    .select('*')
    .eq('id', intent.booking_id)
    .eq('restaurant_id', intent.restaurant_id)
    .maybeSingle();
  if (error) {
    throw new Error('Failed to load mobile review booking.');
  }
  return data;
}

export async function drainMobileReviewIntents(params: {
  readonly maxJobs: number;
}): Promise<MobileReviewDrainSummary> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client.rpc('claim_due_mobile_review_notifications', {
    p_limit: Math.min(Math.max(params.maxJobs, 1), 100),
  });
  if (error) {
    throw new Error('Failed to claim due mobile review intents.');
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const intent of data ?? []) {
    let durableResolution: IntentResolution | null = null;
    try {
      const booking = await fetchIntentBooking(client, intent);
      if (!booking) {
        await updateIntent(client, intent, {
          errorCode: 'REVIEW_WHATSAPP_BOOKING_STALE',
          status: 'skipped',
        });
        skipped += 1;
        continue;
      }

      const pendingFinalization = await finalizePendingAttempt(intent);
      if (pendingFinalization) {
        await updateIntent(client, intent, pendingFinalization);
        if (pendingFinalization.status === 'processed') {
          sent += 1;
        } else {
          failed += 1;
        }
        continue;
      }

      const result = await dispatchBookingReviewWhatsApp(booking, intent.restaurant_id);
      const resolution = resolveDispatchResult(result);
      durableResolution = resolution.attemptFinalization ? resolution : null;
      await updateIntent(client, intent, resolution);
      if (resolution.status === 'processed') {
        sent += 1;
      } else if (resolution.status === 'skipped') {
        skipped += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      if (error instanceof MobileReviewIntentClaimLostError) {
        failed += 1;
        continue;
      }
      const retryable = intent.mobile_intent_attempts < MAX_INTENT_ATTEMPTS;
      await updateIntent(
        client,
        intent,
        durableResolution ?? {
          errorCode: 'REVIEW_WHATSAPP_INFRASTRUCTURE_FAILURE',
          status: retryable ? 'pending' : 'failed',
        },
      );
      failed += 1;
    }
  }

  return { processed: (data ?? []).length, sent, skipped, failed };
}

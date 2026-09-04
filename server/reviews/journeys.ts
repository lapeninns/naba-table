import 'server-only';

import { z } from 'zod';

import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type ReviewRpcClient = Pick<SupabaseClient<Database>, 'rpc'>;

const reviewJourneySchema = z.object({
  reviewRequestId: z.string().uuid().or(z.string().min(1)),
  state: z.enum(['scheduled', 'active', 'clicked', 'observed', 'suppressed', 'expired']),
  primaryChannel: z.enum(['whatsapp', 'email']).nullable(),
  scheduledFor: z.iso.datetime({ offset: true }),
  followupScheduledFor: z.iso.datetime({ offset: true }).nullable(),
  suppressionReason: z.string().nullable(),
});

export type ReviewJourney = z.infer<typeof reviewJourneySchema>;
export type ReviewChannel = 'whatsapp' | 'email';
export type ReviewEventType =
  | 'eligible'
  | 'scheduled'
  | 'suppressed'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'opened'
  | 'link_clicked'
  | 'failed'
  | 'bounced'
  | 'complained'
  | 'skipped'
  | 'review_observed'
  | 'cost_settled';
export type ReviewEventProvider = 'twilio' | 'resend' | 'google_business_profile' | 'nabatable';

export async function createReviewJourney(
  input: {
    readonly bookingId: string;
    readonly restaurantId: string;
    readonly scheduledFor: string;
    readonly emailEligible: boolean;
    readonly whatsappEligible: boolean;
    readonly campaignKey?: string;
    readonly experimentArm?: string;
  },
  client: ReviewRpcClient = getServiceSupabaseClient(),
): Promise<ReviewJourney> {
  const { data, error } = await client.rpc('schedule_review_request_v1', {
    p_booking_id: input.bookingId,
    p_restaurant_id: input.restaurantId,
    p_scheduled_for: input.scheduledFor,
    p_email_eligible: input.emailEligible,
    p_whatsapp_eligible: input.whatsappEligible,
    p_campaign_key: input.campaignKey ?? 'review-growth-v1',
    p_experiment_arm: input.experimentArm ?? 'sequenced',
  });
  if (error) throw new Error('Failed to create review journey.');
  return reviewJourneySchema.parse(data);
}

export async function canSendReviewRequest(
  input: {
    readonly restaurantId: string;
    readonly reviewRequestId: string;
    readonly channel: ReviewChannel;
    readonly now?: string;
  },
  client: ReviewRpcClient = getServiceSupabaseClient(),
): Promise<boolean> {
  const { data, error } = await client.rpc('can_send_review_request_v1', {
    p_channel: input.channel,
    p_now: input.now ?? new Date().toISOString(),
    p_restaurant_id: input.restaurantId,
    p_review_request_id: input.reviewRequestId,
  });
  if (error) return false;
  return data === true;
}

export async function recordReviewRequestEvent(
  input: {
    readonly restaurantId: string;
    readonly reviewRequestId: string;
    readonly eventType: ReviewEventType;
    readonly channel?: ReviewChannel | null;
    readonly provider: ReviewEventProvider;
    readonly providerEventId?: string | null;
    readonly idempotencyKey: string;
    readonly occurredAt: string;
    readonly costMicrounits?: number | null;
    readonly metadata?: Record<string, Json | undefined>;
  },
  client: ReviewRpcClient = getServiceSupabaseClient(),
): Promise<boolean> {
  const metadata = Object.fromEntries(
    Object.entries(input.metadata ?? {}).filter(
      (entry): entry is [string, Json] => entry[1] !== undefined,
    ),
  );
  const { data, error } = await client.rpc('record_review_request_event_v1', {
    p_channel: input.channel ?? null,
    p_cost_microunits: input.costMicrounits ?? null,
    p_event_type: input.eventType,
    p_idempotency_key: input.idempotencyKey,
    p_metadata: metadata,
    p_occurred_at: input.occurredAt,
    p_provider: input.provider,
    p_provider_event_id: input.providerEventId ?? null,
    p_restaurant_id: input.restaurantId,
    p_review_request_id: input.reviewRequestId,
  });
  if (error) throw new Error('Failed to record review event.');
  return data === true;
}

export async function accelerateReviewEmailFollowup(
  input: { readonly restaurantId: string; readonly reviewRequestId: string; readonly now?: string },
  client: ReviewRpcClient = getServiceSupabaseClient(),
): Promise<boolean> {
  const { data, error } = await client.rpc('accelerate_review_email_followup_v1', {
    p_now: input.now ?? new Date().toISOString(),
    p_restaurant_id: input.restaurantId,
    p_review_request_id: input.reviewRequestId,
  });
  if (error) throw new Error('Failed to accelerate review email recovery.');
  return data === true;
}

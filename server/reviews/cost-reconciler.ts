import 'server-only';

import { env } from '@/lib/env';
import { fetchTwilioMessage } from '@/lib/twilio/sms';
import { recordReviewRequestEvent } from '@/server/reviews/journeys';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Json } from '@/types/supabase';

type ReviewCostCandidate = {
  readonly attemptId: string;
  readonly providerMessageId: string;
  readonly restaurantId: string;
  readonly reviewRequestId: string;
};

type ReviewCostDependencies = {
  readonly listCandidates: () => Promise<ReviewCostCandidate[]>;
  readonly fetchMessage: (
    providerMessageId: string,
  ) => Promise<{ readonly price: string | null; readonly priceUnit: string | null }>;
  readonly recordCost: (input: {
    readonly costMicrounits: number;
    readonly currency: string;
    readonly providerMessageId: string;
    readonly restaurantId: string;
    readonly reviewRequestId: string;
  }) => Promise<void>;
  readonly markSettled: (input: {
    readonly attemptId: string;
    readonly costMicrounits: number;
    readonly currency: string;
  }) => Promise<void>;
};

function parseCostMicrounits(price: string | null): number | null {
  if (!price || !/^-?\d+(?:\.\d{1,8})?$/.test(price.trim())) return null;
  const numeric = Math.abs(Number(price));
  if (!Number.isFinite(numeric) || numeric > 10_000) return null;
  return Math.round(numeric * 1_000_000);
}

export async function reconcileReviewMessageCostsWithDependencies(
  dependencies: ReviewCostDependencies,
): Promise<{ scanned: number; settled: number; pending: number; failed: number }> {
  const candidates = await dependencies.listCandidates();
  let settled = 0;
  let pending = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const message = await dependencies.fetchMessage(candidate.providerMessageId);
      const costMicrounits = parseCostMicrounits(message.price);
      const currency = message.priceUnit?.trim().toUpperCase() ?? '';
      if (costMicrounits === null || !/^[A-Z]{3}$/.test(currency)) {
        pending += 1;
        continue;
      }
      await dependencies.recordCost({
        costMicrounits,
        currency,
        providerMessageId: candidate.providerMessageId,
        restaurantId: candidate.restaurantId,
        reviewRequestId: candidate.reviewRequestId,
      });
      await dependencies.markSettled({ attemptId: candidate.attemptId, costMicrounits, currency });
      settled += 1;
    } catch {
      failed += 1;
    }
  }
  return { scanned: candidates.length, settled, pending, failed };
}

function isSettledMetadata(metadata: Json): boolean {
  return Boolean(
    metadata &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    metadata.reviewCostSettledAt,
  );
}

export async function reconcileReviewMessageCosts() {
  const client = getServiceSupabaseClient();
  const { accountSid, apiKeySid, apiKeySecret, authToken } = env.twilio;
  if (!accountSid || (!authToken && !(apiKeySid && apiKeySecret))) {
    return { scanned: 0, settled: 0, pending: 0, failed: 0 };
  }

  return reconcileReviewMessageCostsWithDependencies({
    listCandidates: async () => {
      const since = new Date(Date.now() - 45 * 86_400_000).toISOString();
      const { data: notifications, error: notificationError } = await client
        .from('mobile_notifications')
        .select('id,restaurant_id,review_request_id')
        .not('review_request_id', 'is', null)
        .gte('created_at', since)
        .limit(250);
      if (notificationError) throw notificationError;
      const notificationById = new Map(
        (notifications ?? []).map((notification) => [notification.id, notification]),
      );
      if (notificationById.size === 0) return [];

      const { data: attempts, error: attemptError } = await client
        .from('mobile_notification_attempts')
        .select('id,notification_id,provider_message_id,metadata')
        .eq('provider', 'twilio')
        .eq('channel', 'whatsapp')
        .in('notification_id', [...notificationById.keys()])
        .not('provider_message_id', 'is', null)
        .limit(100);
      if (attemptError) throw attemptError;

      return (attempts ?? []).flatMap((attempt): ReviewCostCandidate[] => {
        const notification = notificationById.get(attempt.notification_id);
        if (
          !notification?.review_request_id ||
          !attempt.provider_message_id ||
          isSettledMetadata(attempt.metadata)
        ) {
          return [];
        }
        return [
          {
            attemptId: attempt.id,
            providerMessageId: attempt.provider_message_id,
            restaurantId: notification.restaurant_id,
            reviewRequestId: notification.review_request_id,
          },
        ];
      });
    },
    fetchMessage: async (providerMessageId) =>
      fetchTwilioMessage({
        accountSid,
        apiKeySid: apiKeySid ?? undefined,
        apiKeySecret: apiKeySecret ?? undefined,
        authToken: authToken ?? undefined,
        messageSid: providerMessageId,
      }),
    recordCost: async (input) => {
      await recordReviewRequestEvent(
        {
          channel: 'whatsapp',
          costMicrounits: input.costMicrounits,
          eventType: 'cost_settled',
          idempotencyKey: `twilio-cost:${input.providerMessageId}`,
          metadata: { currency: input.currency },
          occurredAt: new Date().toISOString(),
          provider: 'twilio',
          providerEventId: input.providerMessageId,
          restaurantId: input.restaurantId,
          reviewRequestId: input.reviewRequestId,
        },
        client,
      );
    },
    markSettled: async ({ attemptId, costMicrounits, currency }) => {
      const { data: attempt, error: readError } = await client
        .from('mobile_notification_attempts')
        .select('metadata')
        .eq('id', attemptId)
        .single();
      if (readError) throw readError;
      const existing =
        attempt.metadata && typeof attempt.metadata === 'object' && !Array.isArray(attempt.metadata)
          ? attempt.metadata
          : {};
      const { error } = await client
        .from('mobile_notification_attempts')
        .update({
          metadata: {
            ...existing,
            reviewCostCurrency: currency,
            reviewCostMicrounits: costMicrounits,
            reviewCostSettledAt: new Date().toISOString(),
          },
        })
        .eq('id', attemptId);
      if (error) throw error;
    },
  });
}

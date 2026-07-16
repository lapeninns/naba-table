import { isCloudflareGatewayConfigured } from '@/server/cloudflare/gateway';

import {
  cancelEmailIntentByDedupeKey,
  cancelEmailIntentForRestaurant,
  drainDueEmailIntents,
  getEmailQueueStatusFromIntents,
  requeueFailedEmailIntentForRestaurant,
  scheduleEmailIntent,
} from './email-intents';
export {
  EMAIL_DLQ_NAME,
  EMAIL_JOB_TYPE_VALUES,
  EMAIL_QUEUE_NAME,
  type EmailJobPayload,
  type EmailJobType,
  type EmailQueueDrainResult,
  type EmailQueueStatusSnapshot,
  type QueueJobSummary,
} from './email-contract';

import type {
  EmailJobPayload,
  EmailJobType,
  EmailQueueDrainResult,
  EmailQueueStatusSnapshot,
} from './email-contract';

type EnqueueEmailOptions = {
  jobId?: string;
  delayMs?: number;
  attempts?: number;
  backoff?: unknown;
};

function resolveScheduledFor(payload: EmailJobPayload, delayMs?: number): string {
  if (payload.scheduledFor) {
    return payload.scheduledFor;
  }

  const delay = typeof delayMs === 'number' && Number.isFinite(delayMs) ? Math.max(0, delayMs) : 0;
  return new Date(Date.now() + delay).toISOString();
}

export function isEmailQueueGatewayConfigured(): boolean {
  return isCloudflareGatewayConfigured();
}

export async function enqueueEmailJob(
  payload: EmailJobPayload,
  options: EnqueueEmailOptions = {},
): Promise<void> {
  await scheduleEmailIntent(
    {
      ...payload,
      scheduledFor: resolveScheduledFor(payload, options.delayMs),
    },
    {
      jobId: options.jobId,
      attempts: options.attempts,
      backoff: options.backoff as { type?: 'fixed' | 'exponential'; delay?: number } | undefined,
    },
  );
}

export async function removeEmailJob(jobId: string): Promise<boolean> {
  try {
    return await cancelEmailIntentByDedupeKey(jobId);
  } catch (error) {
    console.warn('[queue][email] failed to remove intent', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function cancelRestaurantEmailQueueJob(params: {
  jobId: string;
  restaurantId: string;
}): Promise<'cancelled' | 'not_found'> {
  return cancelEmailIntentForRestaurant({
    dedupeKey: params.jobId,
    restaurantId: params.restaurantId,
  });
}

export async function requeueRestaurantEmailQueueJob(params: {
  jobId: string;
  restaurantId: string;
}): Promise<'requeued' | 'not_found' | 'not_requeueable'> {
  return requeueFailedEmailIntentForRestaurant({
    dedupeKey: params.jobId,
    restaurantId: params.restaurantId,
  });
}

export async function getEmailQueueStatus(
  includeJobs = false,
  options?: {
    jobLimit?: number | 'all';
    restaurantId?: string | null;
  },
): Promise<EmailQueueStatusSnapshot> {
  return getEmailQueueStatusFromIntents(includeJobs, options);
}

export async function triggerEmailQueueDrain(params?: {
  types?: EmailJobType[] | Set<EmailJobType> | null;
  maxJobs?: number | null;
}): Promise<EmailQueueDrainResult> {
  return drainDueEmailIntents(params);
}

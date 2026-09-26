export type EmailJobType =
  | 'request_received'
  | 'confirmation'
  | 'updated'
  | 'cancelled'
  | 'reminder_24h'
  | 'reminder_short'
  | 'review_request'
  | 'booking_rejected'
  | 'restaurant_cancellation'
  | 'manage_link';

export const EMAIL_JOB_TYPE_VALUES = [
  'request_received',
  'confirmation',
  'updated',
  'cancelled',
  'reminder_24h',
  'reminder_short',
  'review_request',
  'booking_rejected',
  'restaurant_cancellation',
  'manage_link',
] as const satisfies ReadonlyArray<EmailJobType>;

export type EmailJobPayload = {
  bookingId: string;
  restaurantId: string | null;
  type: EmailJobType;
  scheduledFor?: string | null;
  failedReason?: string | null;
  failedAt?: string | null;
  cronAttemptsMade?: number | null;
  reviewRequestId?: string | null;
  reviewStage?: 'primary' | 'followup' | null;
};

export const EMAIL_QUEUE_NAME = 'pending-booking-emails';
export const EMAIL_DLQ_NAME = `${EMAIL_QUEUE_NAME}-dlq`;

export type QueueJobSummary = {
  id: string;
  payload: EmailJobPayload;
  scheduledFor?: string | null;
  status?: string | null;
};

export type EmailQueueStatusSnapshot = {
  status: 'ok' | 'disabled';
  provider: 'cloudflare';
  queue: {
    name: string;
    dlqName: string;
    counts: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      total: number;
      dlq?: number | null;
    };
    jobs?: {
      waiting?: QueueJobSummary[];
      active?: QueueJobSummary[];
      failed?: QueueJobSummary[];
      delayed?: QueueJobSummary[];
      dlq?: QueueJobSummary[];
    } | null;
  };
  timestamp: string;
};

export type EmailQueueDrainResult = {
  success: boolean;
  message?: string;
  processed?: number;
  stats?: {
    sent: number;
    skipped: number;
    failed: number;
  };
  results?: Array<{ jobId: string; success: boolean; skipped?: boolean; error?: string }>;
  filterTypes?: EmailJobType[] | null;
  debug?: Record<string, number | string | null | string[]>;
};

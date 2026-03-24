import type { EmailJobType } from '@/server/queue/email';

export type OpsEmailQueueJobStatus = 'waiting' | 'active' | 'delayed' | 'dlq';

export const OPS_EMAIL_QUEUE_JOB_STATUS_VALUES = [
  'waiting',
  'active',
  'delayed',
  'dlq',
] as const satisfies ReadonlyArray<OpsEmailQueueJobStatus>;

export type OpsEmailQueueJobBookingDTO = {
  id: string;
  reference: string;
  customerName: string | null;
  customerEmail: string | null;
  startAt: string | null;
  endAt: string | null;
  status: string | null;
};

export type OpsEmailQueueJobDTO = {
  id: string;
  status: OpsEmailQueueJobStatus;
  type: EmailJobType;
  bookingId: string;
  restaurantId: string | null;
  scheduledFor: string | null;
  failedReason: string | null;
  failedAt: string | null;
  attemptsMade: number | null;
  booking: OpsEmailQueueJobBookingDTO | null;
};

export type OpsEmailQueueSummary = {
  total: number;
  waiting: number;
  active: number;
  delayed: number;
  dlq: number;
};

export type OpsEmailQueueFeedResponse =
  | {
      ok: true;
      restaurantId: string;
      pageInfo: { page: number; pageSize: number; hasNext: boolean; total: number };
      summary: OpsEmailQueueSummary;
      jobs: OpsEmailQueueJobDTO[];
      timestamp: string;
    }
  | {
      ok: false;
      code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INTERNAL';
      error: string;
      message?: string;
    };

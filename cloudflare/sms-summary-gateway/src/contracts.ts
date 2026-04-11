import type { OpsServiceBreakdown, OpsTodayBookingsSummary } from '@/types/ops';

export const SERVICE_NAME = 'sms-summary-gateway';
export const DEFAULT_SEND_LOCAL_TIME = '10:00:00';
export const SEND_WINDOW_MINUTES = 15;
export const IDEMPOTENCY_LOCK_MS = 5 * 60 * 1000;
export const SENT_RETENTION_DAYS = 35;

export type DailySummaryQueueMessage = {
  restaurantId: string;
  localDate: string;
  recipient: string;
  timezone: string;
  dryRun: boolean;
};

export type RestaurantDailySummaryTarget = {
  restaurantId: string;
  timezone: string;
  enabled: boolean;
  recipient: string;
};

export type DailySummaryPreview = {
  date: string;
  timezone: string;
  restaurantId: string;
  summary: Pick<OpsTodayBookingsSummary, 'serviceBreakdown'> & {
    serviceBreakdown: OpsServiceBreakdown;
  };
  message: string;
};

export type DueDispatch = {
  localDate: string;
  dueNow: boolean;
  sendAtIso: string | null;
  windowEndsIso: string | null;
};

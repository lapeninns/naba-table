import { SMS_DELIVERY_STATUS_LABELS } from '@/src/lib/sms-delivery/presentation';

import type {
  OpsSmsDeliveryRange,
  OpsSmsDeliverySummary,
  SmsDeliveryStatus,
} from '@/types/smsDelivery';

export const OPS_SMS_DELIVERY_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export const OPS_SMS_DELIVERY_RANGE_OPTIONS: Array<{
  value: OpsSmsDeliveryRange;
  label: string;
}> = [
  { value: '24h', label: 'Last 24h' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

export const OPS_SMS_DELIVERY_STATUS_FILTERS: Array<{
  value: SmsDeliveryStatus;
  label: string;
}> = (['queued', 'sent', 'delivered', 'undelivered', 'failed'] as const).map((value) => ({
  value,
  label: SMS_DELIVERY_STATUS_LABELS[value],
}));

export function formatSmsStuckForHint(stuckForMs: number | null | undefined): string | null {
  if (typeof stuckForMs !== 'number' || !Number.isFinite(stuckForMs) || stuckForMs <= 0) {
    return null;
  }
  const mins = Math.floor(stuckForMs / 60000);
  if (mins >= 120) {
    const hours = Math.floor(mins / 60);
    return `stuck ${hours}h`;
  }
  return `stuck ${Math.max(1, mins)}m`;
}

export function getSmsDeliveryFailureCount(summary: OpsSmsDeliverySummary): number {
  return summary.failed + summary.undelivered;
}

export function getSmsDeliveryRatePercent(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  return Math.round(rate * 100);
}

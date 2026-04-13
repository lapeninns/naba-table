import { DateTime } from 'luxon';

import type { SmsDeliveryStatus } from '@/types/smsDelivery';

export const SMS_DELIVERY_STATUS_LABELS: Record<SmsDeliveryStatus, string> = {
  queued: 'Queued',
  sent: 'Sent',
  delivered: 'Delivered',
  undelivered: 'Undelivered',
  failed: 'Failed',
};

export function formatSmsDeliveryOccurredAt(iso: string | null, timezone: string): string | null {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { zone: timezone });
  if (!dt.isValid) return null;
  return dt.toFormat('EEE, MMM d · HH:mm');
}

export function getSmsDeliveryStatusBadgeTone(
  status: SmsDeliveryStatus,
): { variant: 'outline' | 'destructive' | 'secondary'; className?: string } {
  switch (status) {
    case 'delivered':
      return { variant: 'outline', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
    case 'queued':
      return { variant: 'outline', className: 'border-amber-200 bg-amber-50 text-amber-800' };
    case 'sent':
      return { variant: 'outline', className: 'border-slate-200 bg-slate-50 text-slate-700' };
    case 'undelivered':
    case 'failed':
      return { variant: 'destructive' };
    default:
      return { variant: 'secondary' };
  }
}

export function formatSmsTypeLabel(value: string | null): string {
  if (!value) return 'SMS';

  switch (value) {
    case 'booking_confirmation':
      return 'Booking confirmation';
    case 'booking_update':
      return 'Booking update';
    case 'booking_cancellation':
      return 'Booking cancellation';
    case 'restaurant_cancellation':
      return 'Restaurant cancellation';
    default:
      return value
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
}

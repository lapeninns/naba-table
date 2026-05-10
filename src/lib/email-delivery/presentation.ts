import { DateTime } from 'luxon';

import type { EmailDeliveryStatus } from '@/types/emailDelivery';

export const EMAIL_DELIVERY_STATUS_LABELS: Record<EmailDeliveryStatus, string> = {
  sent: 'Sent',
  delivered: 'Delivered',
  delivery_delayed: 'Delayed',
  bounced: 'Bounced',
  complained: 'Complaint',
  failed: 'Failed',
};

export function formatEmailDeliveryOccurredAt(iso: string | null, timezone: string): string | null {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { zone: timezone });
  if (!dt.isValid) return null;
  return dt.toFormat('EEE, MMM d · HH:mm');
}

export function getEmailDeliveryStatusBadgeTone(status: EmailDeliveryStatus): {
  variant: 'outline' | 'destructive' | 'secondary';
  className?: string;
} {
  switch (status) {
    case 'delivered':
      return { variant: 'outline', className: 'border-primary/30 bg-primary/10 text-primary' };
    case 'sent':
      return {
        variant: 'outline',
        className: 'border-border bg-muted/40 text-muted-foreground',
      };
    case 'delivery_delayed':
      return { variant: 'outline', className: 'border-border bg-muted/40 text-foreground' };
    case 'bounced':
    case 'complained':
    case 'failed':
      return { variant: 'destructive' };
    default:
      return { variant: 'secondary' };
  }
}

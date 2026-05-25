import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  EMAIL_DELIVERY_STATUS_LABELS,
  getEmailDeliveryStatusBadgeTone,
} from '@src/lib/email-delivery/presentation';

import type { EmailDeliveryStatus } from '@/types/emailDelivery';

export function OpsEmailDeliveryStatusBadge({ status }: { status: EmailDeliveryStatus }) {
  const tone = getEmailDeliveryStatusBadgeTone(status);
  return (
    <Badge
      variant={tone.variant}
      className={cn(
        'text-[10px] font-bold tracking-wide whitespace-nowrap uppercase',
        tone.className,
      )}
    >
      {EMAIL_DELIVERY_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

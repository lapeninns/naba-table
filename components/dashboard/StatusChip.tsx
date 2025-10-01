import { Badge } from '@/components/ui/badge';
import type { BookingStatus } from '@/hooks/useBookings';
import type { CSSProperties } from 'react';

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  pending_allocation: 'Pending allocation',
  cancelled: 'Cancelled',
};

const STATUS_ACCENT: Record<BookingStatus, string> = {
  confirmed: '#047857',
  pending: '#b45309',
  pending_allocation: '#0369a1',
  cancelled: '#b91c1c',
};

export function StatusChip({ status }: { status: BookingStatus }) {
  return (
    <Badge
      variant="secondary"
      aria-label={`Booking status: ${STATUS_LABEL[status]}`}
      style={{ '--status-accent': STATUS_ACCENT[status] } as CSSProperties}
      className="relative flex items-center gap-2 border-transparent bg-muted/60 px-3 py-1 text-xs font-medium capitalize text-foreground before:block before:h-2 before:w-2 before:rounded-full before:bg-[color:var(--status-accent)]"
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}

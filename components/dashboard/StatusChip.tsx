import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BookingStatus } from '@/hooks/useBookings';

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  pending_allocation: 'Pending allocation',
  cancelled: 'Cancelled',
};

const STATUS_CLASSNAME: Record<BookingStatus, string> = {
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  pending_allocation: 'bg-blue-100 text-blue-800 border-blue-200',
  cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
};

export function StatusChip({ status }: { status: BookingStatus }) {
  return (
    <Badge
      variant="outline"
      aria-label={`Booking status: ${STATUS_LABEL[status]}`}
      className={cn('capitalize px-3 py-1 text-xs font-medium', STATUS_CLASSNAME[status])}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}

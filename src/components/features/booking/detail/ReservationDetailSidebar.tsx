import Link from 'next/link';

import {
  GhostButton,
  InlineAlert,
  ManageBookingPanel,
} from '@/components/features/booking/ui/BookingComponents';
import { Button } from '@/components/ui/button';

type ReservationDetailSidebarProps = {
  actionDisabled: boolean;
  canManage: boolean;
  handleCancel: () => void;
  handleEdit: () => void;
  handleRebook: () => void;
  isFetching: boolean;
  reservationId: string;
};

export function ReservationDetailSidebar({
  actionDisabled,
  canManage,
  handleCancel,
  handleEdit,
  handleRebook,
  isFetching,
  reservationId,
}: ReservationDetailSidebarProps) {
  return (
    <div className="space-y-6">
      <ManageBookingPanel
        title="Manage booking"
        actions={
          <div className="space-y-3">
            <Button
              className="min-h-[48px] w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              size="lg"
              onClick={handleEdit}
              disabled={actionDisabled}
            >
              Modify Details
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-full border-border min-h-[44px]"
              size="lg"
              onClick={handleCancel}
              disabled={actionDisabled}
            >
              Cancel Booking
            </Button>
            <GhostButton onClick={handleRebook} disabled={!canManage || isFetching}>
              Book Again
            </GhostButton>
          </div>
        }
      />

      {!canManage && (
        <InlineAlert tone="info">
          <div className="flex flex-col gap-1">
            <p className="font-semibold">Sign in to modify this reservation.</p>
            <Link
              href={`/auth/signin?redirectedFrom=/guest/bookings/${reservationId}`}
              className="font-semibold text-primary underline"
            >
              Sign In →
            </Link>
          </div>
        </InlineAlert>
      )}
    </div>
  );
}

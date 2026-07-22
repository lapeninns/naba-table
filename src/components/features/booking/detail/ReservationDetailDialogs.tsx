import dynamic from 'next/dynamic';

import type { ReservationVenue } from './reservationDetailDomain';
import type { BookingDTO } from '@/hooks/useBookings';

const CancelBookingDialog = dynamic(
  () => import('@/components/features/dashboard/bookings-table/CancelBookingDialog').then((m) => m.CancelBookingDialog),
  {
    loading: () => <div className="h-10" />,
  },
);

const EditBookingDialog = dynamic(
  () => import('@/components/features/dashboard/bookings-table/EditBookingDialog').then((m) => m.EditBookingDialog),
  {
    loading: () => <div className="h-10" />,
  },
);

type ReservationDetailDialogsProps = {
  bookingDto: BookingDTO | null;
  closeCancelDialog: (open: boolean) => void;
  closeEditDialog: (open: boolean) => void;
  isCancelOpen: boolean;
  isEditOpen: boolean;
  venue: ReservationVenue;
};

export function ReservationDetailDialogs({
  bookingDto,
  closeCancelDialog,
  closeEditDialog,
  isCancelOpen,
  isEditOpen,
  venue,
}: ReservationDetailDialogsProps) {
  if (!bookingDto) return null;

  return (
    <>
      <EditBookingDialog
        booking={bookingDto}
        open={isEditOpen}
        onOpenChange={closeEditDialog}
        restaurantSlug={venue.slug ?? bookingDto.restaurantSlug ?? null}
        restaurantTimezone={venue.timezone ?? bookingDto.restaurantTimezone ?? null}
      />
      <CancelBookingDialog
        booking={bookingDto}
        open={isCancelOpen}
        onOpenChange={closeCancelDialog}
      />
    </>
  );
}

'use client';

import dynamic from 'next/dynamic';

import type { BookingDTO } from '@/hooks/useBookings';

const OpsCancelBookingAlertDialog = dynamic(
  () =>
    import('@/components/features/bookings/components/OpsCancelBookingAlertDialog').then(
      (m) => m.OpsCancelBookingAlertDialog,
    ),
  {
    loading: () => null,
  },
);

const EditBookingDialog = dynamic(
  () => import('@/components/features/dashboard/bookings-table/EditBookingDialog').then((m) => m.EditBookingDialog),
  {
    loading: () => <div className="h-10" />,
  },
);

const BookingDetailsDialogWrapper = dynamic(
  () =>
    import('@/components/features/bookings/BookingDetailsDialogWrapper').then(
      (m) => m.BookingDetailsDialogWrapper,
    ),
  {
    loading: () => null,
  },
);

export type OpsDashboardDialogsProps = {
  detailsBooking: BookingDTO | null;
  isDetailsOpen: boolean;
  onDetailsOpenChange: (open: boolean) => void;
  editBooking: BookingDTO | null;
  isEditOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  restaurantSlug?: string | null;
  restaurantTimezone?: string | null;
  cancelBooking: BookingDTO | null;
  isCancelOpen: boolean;
  onCancelOpenChange: (open: boolean) => void;
  onConfirmCancel: () => void;
  isCancelPending: boolean;
};

export function OpsDashboardDialogs({
  detailsBooking,
  isDetailsOpen,
  onDetailsOpenChange,
  editBooking,
  isEditOpen,
  onEditOpenChange,
  restaurantSlug,
  restaurantTimezone,
  cancelBooking,
  isCancelOpen,
  onCancelOpenChange,
  onConfirmCancel,
  isCancelPending,
}: OpsDashboardDialogsProps) {
  return (
    <>
      {isDetailsOpen ? (
        <BookingDetailsDialogWrapper
          bookingId={detailsBooking?.id ?? null}
          initialData={detailsBooking}
          open={isDetailsOpen}
          onOpenChange={onDetailsOpenChange}
        />
      ) : null}
      <EditBookingDialog
        booking={editBooking}
        open={isEditOpen}
        onOpenChange={onEditOpenChange}
        restaurantSlug={restaurantSlug}
        restaurantTimezone={restaurantTimezone}
        mode="ops"
      />
      <OpsCancelBookingAlertDialog
        open={isCancelOpen}
        onOpenChange={onCancelOpenChange}
        customerName={cancelBooking?.customerName ?? null}
        partySize={cancelBooking?.partySize ?? null}
        whenLabel={null}
        onConfirm={onConfirmCancel}
        isPending={isCancelPending}
      />
    </>
  );
}

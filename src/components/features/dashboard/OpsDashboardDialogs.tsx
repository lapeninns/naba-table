'use client';

import dynamic from 'next/dynamic';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import type { BookingDTO } from '@/hooks/useBookings';

const EditBookingDialog = dynamic(
  () => import('@/components/dashboard/EditBookingDialog').then((m) => m.EditBookingDialog),
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
      <AlertDialog open={isCancelOpen} onOpenChange={onCancelOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelBooking
                ? `You’re about to cancel ${cancelBooking.customerName ?? 'this booking'} for ${cancelBooking.partySize} covers. This action cannot be undone.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelPending}>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isCancelPending}
            >
              Confirm cancellation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

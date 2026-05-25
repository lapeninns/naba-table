'use client';

import dynamic from 'next/dynamic';

import { BookingsTable } from '@/components/dashboard/BookingsTable';
import { BookingDetailsDialogWrapper } from '@/components/features/bookings/BookingDetailsDialogWrapper';
import { OpsBookingsPageHeader } from '@/components/features/bookings/components/OpsBookingsPageHeader';
import {
  BookingStateRegistrar,
  NoRestaurantAccess,
  SelectingRestaurantFallback,
} from '@/components/features/bookings/components/OpsBookingsPageStates';
import { OpsBookingsTableFilterBanner } from '@/components/features/bookings/components/OpsBookingsTableFilterBanner';
import { OpsBookingsToolbar } from '@/components/features/bookings/components/OpsBookingsToolbar';
import { OpsCancelBookingAlertDialog } from '@/components/features/bookings/components/OpsCancelBookingAlertDialog';
import { OPS_STATUS_TABS } from '@/components/features/bookings/opsBookingsConstants';
import { resolveOpsBookingsRestaurantName } from '@/components/features/bookings/opsBookingsQueryDomain';
import { useOpsBookingsState } from '@/components/features/bookings/useOpsBookingsState';
import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Button } from '@/components/ui/button';
import { BookingStateMachineProvider } from '@/contexts/booking-state-machine';

import type { OpsBookingsClientStateParams } from './opsBookingsTypes';
import type { StatusFilter } from '@/hooks/useBookingsTableState';

const EditBookingDialog = dynamic(
  () => import('@/components/dashboard/EditBookingDialog').then((m) => m.EditBookingDialog),
  {
    loading: () => <div className="h-10" />,
  },
);

export type OpsBookingsClientProps = OpsBookingsClientStateParams;

export function OpsBookingsClient(props: OpsBookingsClientProps) {
  const state = useOpsBookingsState(props);
  const {
    memberships,
    activeRestaurantId,
    activeMembership,
    accountSnapshot,
    restaurantTimezone,
    restaurantSlug,
    queryState,
    dataState,
    lifecycle,
    rows,
    dialogs,
    handleDetailsById,
    handleEditById,
    handleCancelById,
    initialSnapshots,
  } = state;

  if (memberships.length === 0) {
    return <NoRestaurantAccess />;
  }

  if (!activeRestaurantId) {
    return <SelectingRestaurantFallback />;
  }

  const currentRestaurantName = resolveOpsBookingsRestaurantName({
    accountRestaurantName: accountSnapshot.restaurantName,
    activeMembershipRestaurantName: activeMembership?.restaurantName,
  });
  const bookingsQuery = dataState.bookingsQuery;

  return (
    <BookingStateMachineProvider initialBookings={initialSnapshots}>
      <BookingStateRegistrar bookings={dataState.derivedData.bookings} />
      <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
        <Button
          asChild
          variant="link"
          className="sr-only h-auto p-0 focus:not-sr-only focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <a href="#ops-bookings-list">Skip to bookings list</a>
        </Button>
        <OpsBookingsPageHeader
          appliedDate={dataState.appliedDateRange?.date ?? null}
          currentRestaurantName={currentRestaurantName}
          opsBasePath={queryState.opsBasePath}
          restaurantTimezone={restaurantTimezone}
        />

        <OpsBookingsToolbar
          bookingsQuery={bookingsQuery}
          dataState={dataState}
          queryState={queryState}
          restaurantTimezone={restaurantTimezone}
        />

        <section className="space-y-3">
          <OpsBookingsTableFilterBanner queryState={queryState} />

          <BookingsTable
            rows={rows}
            total={dataState.bookingsTotal}
            statusFilter={queryState.statusFilter as StatusFilter}
            isLoading={bookingsQuery.isLoading}
            isFetching={bookingsQuery.isFetching && !bookingsQuery.isFetchingNextPage}
            error={bookingsQuery.error ?? null}
            searchTerm={queryState.search}
            onSearchChange={queryState.handleSearchInput}
            onStatusFilterChange={queryState.handleStatusFilterSelect}
            onLoadMore={() => {
              if (!state.isOnline) {
                return;
              }
              if (bookingsQuery.hasNextPage && !bookingsQuery.isFetchingNextPage) {
                void bookingsQuery.fetchNextPage();
              }
            }}
            hasNextPage={bookingsQuery.hasNextPage ?? false}
            isFetchingNextPage={bookingsQuery.isFetchingNextPage ?? false}
            onRetry={() => bookingsQuery.refetch()}
            onDetails={handleDetailsById}
            onEdit={handleEditById}
            onCancel={handleCancelById}
            variant="ops"
            statusOptions={OPS_STATUS_TABS}
            opsBasePath={queryState.opsBasePath}
            opsActionMode="full"
            opsLifecycle={{
              onCheckIn: lifecycle.onCheckIn,
              onCheckOut: lifecycle.onCheckOut,
              onMarkNoShow: lifecycle.onMarkNoShow,
              onUndoNoShow: lifecycle.onUndoNoShow,
            }}
            showHeaderTitle={false}
            hideHeader
            timezone={restaurantTimezone || 'UTC'}
          />
        </section>

        <BookingDetailsDialogWrapper
          bookingId={dialogs.detailsBooking?.id ?? null}
          initialData={dialogs.detailsBooking}
          open={dialogs.isDetailsOpen}
          onOpenChange={dialogs.onDetailsOpenChange}
        />
        <EditBookingDialog
          booking={dialogs.editBooking}
          open={dialogs.isEditOpen}
          onOpenChange={dialogs.onEditOpenChange}
          restaurantSlug={restaurantSlug ?? dialogs.editBooking?.restaurantSlug ?? null}
          restaurantTimezone={restaurantTimezone ?? dialogs.editBooking?.restaurantTimezone ?? null}
          mode="ops"
        />
        <OpsCancelBookingAlertDialog
          open={dialogs.isCancelOpen}
          onOpenChange={dialogs.onCancelOpenChange}
          customerName={dialogs.cancelBooking?.customerName ?? null}
          partySize={dialogs.cancelBooking?.partySize ?? null}
          whenLabel={null}
          onConfirm={dialogs.onConfirmCancel}
          isPending={dialogs.isCancelling}
        />
      </OpsPageShell>
    </BookingStateMachineProvider>
  );
}

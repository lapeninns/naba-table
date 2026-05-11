'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

import { BookingsTable } from '@/components/dashboard/BookingsTable';
import { StatusFilterGroup } from '@/components/dashboard/StatusFilterGroup';
import { BookingOfflineBanner } from '@/components/features/booking-state-machine';
import { BookingDetailsDialogWrapper } from '@/components/features/bookings/BookingDetailsDialogWrapper';
import { OpsBookingsDatePicker } from '@/components/features/bookings/components/OpsBookingsDatePicker';
import {
  BookingStateRegistrar,
  NoRestaurantAccess,
  SelectingRestaurantFallback,
} from '@/components/features/bookings/components/OpsBookingsPageStates';
import { OpsBookingsSearchInput } from '@/components/features/bookings/components/OpsBookingsSearchInput';
import { OpsCancelBookingAlertDialog } from '@/components/features/bookings/components/OpsCancelBookingAlertDialog';
import { OPS_STATUS_TABS } from '@/components/features/bookings/opsBookingsConstants';
import { OpsStatusFilter as OpsStatusFilterPopover } from '@/components/features/bookings/OpsStatusFilter';
import { useOpsBookingsState } from '@/components/features/bookings/useOpsBookingsState';
import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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

  const currentRestaurantName =
    activeMembership?.restaurantName ?? accountSnapshot.restaurantName ?? 'This restaurant';
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
        <OpsPageHeader
          title="Manage bookings"
          meta={
            <>
              <Badge variant="secondary" className="rounded-md font-medium">
                {currentRestaurantName}
              </Badge>
              {dataState.appliedDateRange ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/40">•</span>
                  <span>
                    {dataState.appliedDateRange.date}
                    {restaurantTimezone ? ` (${restaurantTimezone})` : ''}
                  </span>
                </span>
              ) : null}
            </>
          }
          secondaryActions={
            <Button asChild size="sm" variant="outline" className="h-11 sm:h-9">
              <Link href={`${queryState.opsBasePath}/dashboard`}>Back to dashboard</Link>
            </Button>
          }
          primaryAction={
            <Button asChild size="sm" className="h-11 sm:h-9">
              <Link href={`${queryState.opsBasePath}/new-bookings`}>New booking</Link>
            </Button>
          }
        />

        <OpsPageToolbar
          sticky
          filters={
            <div className="flex min-w-0 w-full flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
              <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  View
                </span>
                <StatusFilterGroup
                  value={queryState.view as StatusFilter}
                  options={OPS_STATUS_TABS}
                  onChange={(next) => queryState.handleViewChange(next)}
                  ariaLabel="View bookings"
                />
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <OpsBookingsDatePicker
                  value={queryState.selectedDate}
                  timezone={restaurantTimezone || 'UTC'}
                  onSelectDate={queryState.handleSelectServiceDate}
                  onClear={queryState.handleClearServiceDate}
                  onToday={queryState.handleTodayServiceDate}
                />
                <OpsStatusFilterPopover
                  options={dataState.statusFilterOptions}
                  selected={queryState.visibleSelectedStatuses}
                  onToggle={queryState.handleToggleStatus}
                  onClear={queryState.handleClearStatuses}
                  isLoading={dataState.statusSummaryQuery.isLoading}
                />
              </div>
            </div>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {queryState.shouldShowReset ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 sm:h-9"
                  onClick={queryState.handleReset}
                >
                  Reset
                </Button>
              ) : null}
              {queryState.resolvedTime ? (
                <ToggleGroup
                  type="single"
                  value={queryState.resolvedWindowMode}
                  onValueChange={queryState.handleWindowModeChange}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start md:w-auto"
                  aria-label="Booking window"
                >
                  <ToggleGroupItem value="window">Nearby</ToggleGroupItem>
                  <ToggleGroupItem value="day">All day</ToggleGroupItem>
                </ToggleGroup>
              ) : null}
            </div>
          }
          search={
            <OpsBookingsSearchInput
              value={queryState.search}
              onChange={queryState.handleSearchInput}
              onClear={() => queryState.handleSearchInput('')}
              isSearching={bookingsQuery.isFetching && !bookingsQuery.isFetchingNextPage}
              placeholder="Search guests…"
              ariaLabel="Search guests"
              size="toolbar"
            />
          }
        >
          <BookingOfflineBanner />
        </OpsPageToolbar>

        <section className="space-y-3">
          {queryState.resolvedTableId ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="rounded-md text-xs font-medium text-foreground">
                {queryState.resolvedTableLabel ? queryState.resolvedTableLabel : 'Table filter'}
              </Badge>
              {queryState.resolvedTime ? (
                <Badge variant="secondary" className="rounded-md text-xs font-medium">
                  {queryState.resolvedTime}
                </Badge>
              ) : null}
              <Badge variant="secondary" className="rounded-md text-xs font-medium">
                {queryState.resolvedWindowMode === 'window'
                  ? `Nearby ±${queryState.resolvedWindowMinutes}m`
                  : 'All day'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={queryState.handleClearTableFilter}
              >
                Clear filter
              </Button>
            </div>
          ) : null}

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

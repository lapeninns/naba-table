'use client';

import { StatusFilterGroup } from '@/components/dashboard/StatusFilterGroup';
import { BookingOfflineBanner } from '@/components/features/booking-state-machine';
import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Text } from '@/components/ui/typography';

import { OPS_STATUS_TABS } from '../opsBookingsConstants';
import { OpsStatusFilter as OpsStatusFilterPopover } from '../OpsStatusFilter';
import { OpsBookingsDatePicker } from './OpsBookingsDatePicker';
import { OpsBookingsSearchInput } from './OpsBookingsSearchInput';

import type { useOpsBookingsState } from '../useOpsBookingsState';
import type { StatusFilter } from '@/hooks/useBookingsTableState';

type OpsBookingsState = ReturnType<typeof useOpsBookingsState>;

export function OpsBookingsToolbar({
  bookingsQuery,
  dataState,
  queryState,
  restaurantTimezone,
}: {
  bookingsQuery: OpsBookingsState['dataState']['bookingsQuery'];
  dataState: OpsBookingsState['dataState'];
  queryState: OpsBookingsState['queryState'];
  restaurantTimezone: string | null;
}) {
  return (
    <OpsPageToolbar
      sticky
      filters={
        <div className="flex w-full min-w-0 flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5">
            <Text variant="eyebrow" as="span">
              View
            </Text>
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
  );
}

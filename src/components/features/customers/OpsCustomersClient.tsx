'use client';

import { Loader2, RefreshCcw } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StaleBoundary } from '@/components/ui/stale-boundary';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { getSwrUiState } from '@/lib/query/swrUiState';
import { opsHref } from '@/lib/url/opsHref';

import { CustomersTable } from './CustomersTable';
import { ExportCustomersButton } from './ExportCustomersButton';
import { GuestsSummaryMetrics } from './GuestsSummaryMetrics';
import { OpsCustomersFilterToolbar } from './OpsCustomersFilterToolbar';
import { useOpsCustomersDataState } from './useOpsCustomersDataState';
import { useOpsCustomersQueryState } from './useOpsCustomersQueryState';

export type OpsCustomersClientProps = {
  defaultRestaurantId?: string | null;
  focusCustomer?: string | null;
};

export function OpsCustomersClient({
  defaultRestaurantId,
  focusCustomer,
}: OpsCustomersClientProps) {
  const pathname = usePathname();
  const opsBasePath = pathname?.startsWith('/app') ? '/app' : '';
  const opsPath = (path: string) => `${opsBasePath}${path}`;
  const { memberships, activeRestaurantId, setActiveRestaurantId, accountSnapshot } =
    useOpsSession();
  const activeMembership = useOpsActiveMembership();

  const {
    isOnline,
    searchTerm,
    marketingOptIn,
    lastVisit,
    minBookings,
    sort,
    sortBy,
    normalizedSearch,
    sortOption,
    activeFilterBadges,
    hasActiveFilters,
    setSearchTerm,
    setMarketingOptIn,
    setLastVisit,
    handleMinBookingsChange,
    handleSortChange,
    handleClearFilters,
    handleClearFilterBadge,
  } = useOpsCustomersQueryState();

  useEffect(() => {
    if (defaultRestaurantId && !activeRestaurantId) {
      setActiveRestaurantId(defaultRestaurantId);
    }
  }, [activeRestaurantId, defaultRestaurantId, setActiveRestaurantId]);

  const {
    customersQuery,
    error,
    isLoading,
    guestRows,
    isFetchingNextPage,
    hasNextPage,
    isSummaryLoading,
    isSummaryUpdating,
    isRefreshing,
    summary,
    exportFilters,
    handleLoadMore,
    refetch,
  } = useOpsCustomersDataState({
    activeRestaurantId,
    isOnline,
    normalizedSearch,
    marketingOptIn,
    lastVisit,
    minBookings,
    sort,
    sortBy,
  });

  const currentRestaurantName =
    activeMembership?.restaurantName ?? accountSnapshot.restaurantName ?? 'Restaurant';
  // Param-change stale state (filters/search/sort) per docs/technical/react-query-swr-ux.md.
  const swr = getSwrUiState(customersQuery);

  if (memberships.length === 0) {
    return (
      <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
        <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
          <OpsEmptyState
            title="No restaurant access yet"
            description="Ask an owner or manager to send you an invitation so you can view customer data."
            action={
              <Button asChild variant="secondary">
                <Link href={opsHref('/dashboard')}>Return to ops home</Link>
              </Button>
            }
          />
        </section>
      </OpsPageShell>
    );
  }

  if (!activeRestaurantId) {
    return (
      <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
        <section className="mx-auto flex min-h-[40vh] max-w-2xl items-center justify-center">
          <OpsEmptyState
            title="Loading restaurant access…"
            description="We’re preparing your guests. This will only take a moment."
          />
        </section>
      </OpsPageShell>
    );
  }

  return (
    <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
      <OpsPageHeader
        title="Guests"
        meta={
          <>
            <Badge variant="secondary" className="rounded-md font-medium">
              {currentRestaurantName}
            </Badge>
            <span className="text-muted-foreground/40">•</span>
            <span>View, filter, and export guest history.</span>
          </>
        }
        secondaryActions={
          <>
            <Button asChild size="sm" variant="outline" className="h-11 sm:h-9">
              <Link href={opsPath('/dashboard')}>Back to dashboard</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 sm:h-9"
              onClick={() => refetch()}
              disabled={isRefreshing || isLoading}
            >
              {isRefreshing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 size-4" />
              )}
              Refresh
            </Button>
          </>
        }
        primaryAction={
          <ExportCustomersButton
            restaurantId={activeRestaurantId}
            restaurantName={currentRestaurantName}
            disabled={isLoading || !!error}
            sort={sort}
            filters={exportFilters}
          />
        }
      />

      <OpsCustomersFilterToolbar
        activeFilterBadges={activeFilterBadges}
        hasActiveFilters={hasActiveFilters}
        isRefreshing={isRefreshing}
        lastVisit={lastVisit}
        marketingOptIn={marketingOptIn}
        minBookings={minBookings}
        searchTerm={searchTerm}
        sortOption={sortOption}
        onClearFilterBadge={handleClearFilterBadge}
        onClearFilters={handleClearFilters}
        onLastVisitChange={setLastVisit}
        onMarketingOptInChange={setMarketingOptIn}
        onMinBookingsChange={handleMinBookingsChange}
        onSearchTermChange={setSearchTerm}
        onSortChange={handleSortChange}
      />

      <GuestsSummaryMetrics
        summary={summary}
        isLoading={isSummaryLoading}
        isUpdating={isSummaryUpdating}
      />

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Unable to load guests</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error.message}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3">
        {/* Toolbar and summary stay outside; only the guest list dims. */}
        <StaleBoundary isStale={swr.isPlaceholderStale}>
          <CustomersTable
            rows={guestRows}
            isLoading={isLoading}
            hasActiveFilters={hasActiveFilters}
            onLoadMore={handleLoadMore}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            focusCustomerId={focusCustomer}
          />
        </StaleBoundary>
      </section>
    </OpsPageShell>
  );
}

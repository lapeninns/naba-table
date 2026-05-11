'use client';

import { Loader2, RefreshCcw, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { opsHref } from '@/lib/url/opsHref';

import { CustomersTable } from './CustomersTable';
import { ExportCustomersButton } from './ExportCustomersButton';
import { GuestsSummaryMetrics } from './GuestsSummaryMetrics';
import {
  LAST_VISIT_OPTIONS,
  MARKETING_OPTIONS,
  MIN_BOOKINGS_OPTIONS,
  SORT_OPTIONS,
  type LastVisitFilter,
  type MarketingFilter,
  type SortOption,
} from './opsCustomersTypes';
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
  } = useOpsCustomersQueryState();

  useEffect(() => {
    if (defaultRestaurantId && !activeRestaurantId) {
      setActiveRestaurantId(defaultRestaurantId);
    }
  }, [activeRestaurantId, defaultRestaurantId, setActiveRestaurantId]);

  const {
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

  const clearFilterBadge = (key: (typeof activeFilterBadges)[number]['key']) => {
    switch (key) {
      case 'search':
        setSearchTerm('');
        return;
      case 'marketing':
        setMarketingOptIn('all');
        return;
      case 'lastVisit':
        setLastVisit('any');
        return;
      case 'minBookings':
        handleMinBookingsChange('0');
        return;
    }
  };

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

      <OpsPageToolbar
        sticky
        filters={
          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                name="lastVisit"
                value={lastVisit}
                onValueChange={(value) => setLastVisit(value as LastVisitFilter)}
              >
                <SelectTrigger className="h-9 w-full sm:w-[150px]">
                  <SelectValue placeholder="Last visit" />
                </SelectTrigger>
                <SelectContent>
                  {LAST_VISIT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                name="marketingOptIn"
                value={marketingOptIn}
                onValueChange={(value) => setMarketingOptIn(value as MarketingFilter)}
              >
                <SelectTrigger className="h-9 w-full sm:w-[140px]">
                  <SelectValue placeholder="Marketing" />
                </SelectTrigger>
                <SelectContent>
                  {MARKETING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                name="minBookings"
                value={String(minBookings)}
                onValueChange={handleMinBookingsChange}
              >
                <SelectTrigger className="h-9 w-full sm:w-[145px]">
                  <SelectValue placeholder="Min bookings" />
                </SelectTrigger>
                <SelectContent>
                  {MIN_BOOKINGS_OPTIONS.map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      {count === 0 ? 'All bookings' : `≥ ${count} bookings`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                name="sort"
                value={sortOption}
                onValueChange={(value) => handleSortChange(value as SortOption)}
              >
                <SelectTrigger className="h-9 w-full sm:w-[165px]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!hasActiveFilters}
                onClick={handleClearFilters}
              >
                <X className="mr-1 size-4" aria-hidden />
                Clear
              </Button>
            </div>
          </div>
        }
        search={
          <div className="relative w-full md:w-72 md:flex-none">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              name="search"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
              }}
              placeholder="Search guests…"
              className="h-9 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 touch-manipulation"
              aria-label="Search guests"
              autoComplete="off"
            />
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {activeFilterBadges.length > 0 ? (
            activeFilterBadges.map((badge) => (
              <Badge key={badge.key} variant="secondary" className="flex items-center gap-1 py-1">
                <span>{badge.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-5 rounded-full p-0 text-muted-foreground hover:bg-background/60"
                  onClick={() => clearFilterBadge(badge.key)}
                  aria-label={`Remove ${badge.label} filter`}
                >
                  <X aria-hidden />
                </Button>
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">
              Tip: search + min bookings to surface VIP guests fast.
            </span>
          )}

          {isRefreshing ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Updating results…
            </span>
          ) : null}
        </div>
      </OpsPageToolbar>

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
        <CustomersTable
          rows={guestRows}
          isLoading={isLoading}
          hasActiveFilters={hasActiveFilters}
          onLoadMore={handleLoadMore}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          focusCustomerId={focusCustomer}
        />
      </section>
    </OpsPageShell>
  );
}

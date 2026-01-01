'use client';

import { Loader2, RefreshCcw, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { Pagination } from '@/components/dashboard/Pagination';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useToast } from '@/hooks/use-toast';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { useOpsCustomers } from '@/hooks/useOpsCustomers';

import { CustomersTable } from './CustomersTable';
import { ExportCustomersButton } from './ExportCustomersButton';

type MarketingFilter = 'all' | 'opted_in' | 'opted_out';
type LastVisitFilter = 'any' | '30d' | '90d' | '365d' | 'never';
type SortDirection = 'asc' | 'desc';
type SortBy = 'last_visit' | 'bookings';
type SortOption = `${SortBy}_${SortDirection}`;

const LAST_VISIT_OPTIONS: { value: LastVisitFilter; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '365d', label: 'Last year' },
  { value: 'never', label: 'Never visited' },
];

const MARKETING_OPTIONS: { value: MarketingFilter; label: string }[] = [
  { value: 'all', label: 'All marketing' },
  { value: 'opted_in', label: 'Opted in' },
  { value: 'opted_out', label: 'Opted out' },
];

const MIN_BOOKINGS_OPTIONS = [0, 1, 3, 5, 10];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'last_visit_desc', label: 'Most recent visit' },
  { value: 'last_visit_asc', label: 'Oldest visit' },
  { value: 'bookings_desc', label: 'Most bookings' },
  { value: 'bookings_asc', label: 'Fewest bookings' },
];

function isMarketingFilter(value: string | null): value is MarketingFilter {
  return value === 'all' || value === 'opted_in' || value === 'opted_out';
}

function isLastVisitFilter(value: string | null): value is LastVisitFilter {
  return value === 'any' || value === '30d' || value === '90d' || value === '365d' || value === 'never';
}

function isSort(value: string | null): value is SortDirection {
  return value === 'asc' || value === 'desc';
}

function isSortBy(value: string | null): value is SortBy {
  return value === 'last_visit' || value === 'bookings';
}

function encodeSortOption(sortBy: SortBy, sort: SortDirection): SortOption {
  return `${sortBy}_${sort}`;
}

function decodeSortOption(option: SortOption): { sortBy: SortBy; sort: SortDirection } {
  const [sortBy, sort] = option.split('_');
  return {
    sortBy: isSortBy(sortBy) ? sortBy : 'last_visit',
    sort: isSort(sort) ? sort : 'desc',
  };
}

function describeMarketing(value: MarketingFilter): string {
  const option = MARKETING_OPTIONS.find((item) => item.value === value);
  return option?.label ?? 'All marketing';
}

function describeLastVisit(value: LastVisitFilter): string {
  const option = LAST_VISIT_OPTIONS.find((item) => item.value === value);
  return option?.label ?? 'Any time';
}

export type OpsCustomersClientProps = {
  defaultRestaurantId?: string | null;
  focusCustomer?: string | null;
};

export function OpsCustomersClient({ defaultRestaurantId, focusCustomer }: OpsCustomersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = useMemo(() => searchParams?.toString() ?? '', [searchParams]);
  const { memberships, activeRestaurantId, setActiveRestaurantId, accountSnapshot } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const previousRestaurantId = useRef<string | null>(null);

  const parsedFromQuery = useMemo(() => {
    const sp = new URLSearchParams(searchParamsKey);
    const marketingParam = sp.get('marketingOptIn');
    const lastVisitParam = sp.get('lastVisit');
    const sortParam = sp.get('sort');
    const sortByParam = sp.get('sortBy');
    const searchQuery = sp.get('search') ?? '';
    const minBookingsParam = Number.parseInt(sp.get('minBookings') ?? '0', 10);
    const pageParam = Number.parseInt(sp.get('page') ?? '1', 10);
  
    return {
      search: searchQuery,
      marketingOptIn: isMarketingFilter(marketingParam) ? marketingParam : 'all',
      lastVisit: isLastVisitFilter(lastVisitParam) ? lastVisitParam : 'any',
      minBookings: Number.isFinite(minBookingsParam) ? Math.max(0, minBookingsParam) : 0,
      sort: isSort(sortParam) ? sortParam : 'desc',
      sortBy: isSortBy(sortByParam) ? sortByParam : 'last_visit',
      page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
    };
  }, [searchParamsKey]);

  const [searchTerm, setSearchTerm] = useState(parsedFromQuery.search);
  const [marketingOptIn, setMarketingOptIn] = useState<MarketingFilter>(parsedFromQuery.marketingOptIn);
  const [lastVisit, setLastVisit] = useState<LastVisitFilter>(parsedFromQuery.lastVisit);
  const [minBookings, setMinBookings] = useState<number>(parsedFromQuery.minBookings);
  const [sort, setSort] = useState<SortDirection>(parsedFromQuery.sort);
  const [sortBy, setSortBy] = useState<SortBy>(parsedFromQuery.sortBy);
  const [page, setPage] = useState(parsedFromQuery.page);

  useEffect(() => {
    setSearchTerm(parsedFromQuery.search);
    setMarketingOptIn(parsedFromQuery.marketingOptIn);
    setLastVisit(parsedFromQuery.lastVisit);
    setMinBookings(parsedFromQuery.minBookings);
    setSort(parsedFromQuery.sort);
    setSortBy(parsedFromQuery.sortBy);
    setPage(parsedFromQuery.page);
  }, [parsedFromQuery]);

  const debouncedSearch = useDebouncedValue(searchTerm, 250);
  const normalizedSearch = debouncedSearch?.trim();
  const displaySearch = searchTerm.trim();

  useEffect(() => {
    if (defaultRestaurantId && defaultRestaurantId !== activeRestaurantId) {
      setActiveRestaurantId(defaultRestaurantId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultRestaurantId]);

  useEffect(() => {
    if (!activeRestaurantId) return;
    if (previousRestaurantId.current && previousRestaurantId.current !== activeRestaurantId) {
      setPage(1);
    }
    previousRestaurantId.current = activeRestaurantId;
  }, [activeRestaurantId]);

  const syncQueryParams = useCallback(
    (next: {
      search?: string | null;
      marketingOptIn?: MarketingFilter;
      lastVisit?: LastVisitFilter;
      minBookings?: number;
      sort?: SortDirection;
      sortBy?: SortBy;
      page?: number;
    }) => {
      if (!isOnline) {
        return;
      }

      const params = new URLSearchParams(searchParams?.toString() ?? '');

      const applyParam = (key: string, value: string | number | null | undefined, defaultValue?: string | number) => {
        if (value === undefined || value === null || value === '' || (defaultValue !== undefined && value === defaultValue)) {
          params.delete(key);
          return;
        }
        params.set(key, String(value));
      };

      applyParam('search', next.search ?? '', '');
      applyParam('marketingOptIn', next.marketingOptIn, 'all');
      applyParam('lastVisit', next.lastVisit, 'any');
      applyParam('minBookings', next.minBookings ?? 0, 0);
      applyParam('sortBy', next.sortBy, 'last_visit');
      applyParam('sort', next.sort, 'desc');
      applyParam('page', next.page ?? 1, 1);

      const current = searchParams?.toString() ?? '';
      const nextString = params.toString();

      if (current === nextString) {
        return;
      }

      router.replace(`/customers${nextString ? `?${nextString}` : ''}`, { scroll: false });
    },
    [isOnline, router, searchParams],
  );

  useEffect(() => {
    syncQueryParams({
      search: normalizedSearch,
      marketingOptIn,
      lastVisit,
      minBookings,
      sort,
      sortBy,
      page,
    });
  }, [normalizedSearch, marketingOptIn, lastVisit, minBookings, sort, sortBy, page, syncQueryParams]);

  const filters = useMemo(() => {
    if (!activeRestaurantId) {
      return null;
    }
    return {
      restaurantId: activeRestaurantId,
      page,
      pageSize: DASHBOARD_DEFAULT_PAGE_SIZE,
      sort,
      sortBy,
      search: normalizedSearch || undefined,
      marketingOptIn,
      lastVisit,
      minBookings,
    };
  }, [activeRestaurantId, lastVisit, marketingOptIn, minBookings, normalizedSearch, page, sort, sortBy]);

  const { data, error, isLoading, isFetching, refetch } = useOpsCustomers(filters);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (!isOnline) {
        toast({
          title: "You're offline",
          description: 'Reconnect to load more customers.',
        });
        return;
      }
      setPage(nextPage);
    },
    [isOnline, toast],
  );

  const handleSortChange = useCallback((value: SortOption) => {
    const decoded = decodeSortOption(value);
    setSort(decoded.sort);
    setSortBy(decoded.sortBy);
    setPage(1);
  }, []);

  const handleMinBookingsChange = useCallback((value: string) => {
    const parsed = Number.parseInt(value, 10);
    setMinBookings(Number.isFinite(parsed) ? parsed : 0);
    setPage(1);
  }, []);

  const handleMarketingChange = useCallback((value: MarketingFilter) => {
    setMarketingOptIn(value);
    setPage(1);
  }, []);

  const handleLastVisitChange = useCallback((value: LastVisitFilter) => {
    setLastVisit(value);
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setMarketingOptIn('all');
    setLastVisit('any');
    setMinBookings(0);
    setSort('desc');
    setSortBy('last_visit');
    setPage(1);
  }, []);

  const sortOption = useMemo(() => encodeSortOption(sortBy, sort), [sortBy, sort]);

  useEffect(() => {
    if (!focusCustomer || !data?.items?.length) return;
    const selector = `[data-customer-id="${focusCustomer}"]`;
    const emailSelector = `[data-customer-email="${focusCustomer.toLowerCase()}"]`;
    const target =
      (typeof document !== 'undefined' && (document.querySelector<HTMLElement>(selector) ?? document.querySelector<HTMLElement>(emailSelector))) ||
      null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
    }
  }, [data?.items, focusCustomer]);

  const pageInfo = data?.pageInfo ?? {
    page,
    pageSize: DASHBOARD_DEFAULT_PAGE_SIZE,
    total: 0,
    hasNext: false,
  };

  const currentRestaurantName =
    activeMembership?.restaurantName ?? accountSnapshot.restaurantName ?? 'Restaurant';

  const activeFilterBadges = (
    [
      displaySearch
        ? {
            key: 'search',
            label: `Search: "${displaySearch}"`,
            onClear: () => setSearchTerm(''),
          }
        : null,
      marketingOptIn !== 'all'
        ? {
            key: 'marketing',
            label: describeMarketing(marketingOptIn),
            onClear: () => setMarketingOptIn('all'),
          }
        : null,
      lastVisit !== 'any'
        ? {
            key: 'lastVisit',
            label: describeLastVisit(lastVisit),
            onClear: () => setLastVisit('any'),
          }
        : null,
      minBookings > 0
        ? {
            key: 'minBookings',
            label: `Min bookings ${minBookings}`,
            onClear: () => setMinBookings(0),
          }
        : null,
    ].filter(Boolean) as { key: string; label: string; onClear: () => void }[]
  );

  const exportFilters = useMemo(
    () => ({
      sort,
      sortBy,
      search: normalizedSearch || undefined,
      marketingOptIn,
      lastVisit,
      minBookings,
    }),
    [lastVisit, marketingOptIn, minBookings, normalizedSearch, sort, sortBy],
  );

  const hasActiveFilters = activeFilterBadges.length > 0 || sortBy !== 'last_visit' || sort !== 'desc';

  if (memberships.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">No restaurant access yet</h2>
        <p className="text-sm text-muted-foreground">Ask an owner or manager to send you an invitation so you can view customer data.</p>
        <Button asChild variant="secondary">
          <Link href="/guest/dashboard">Back to dashboard</Link>
        </Button>
      </section>
    );
  }

  if (!activeRestaurantId) {
    return (
      <section className="mx-auto flex min-h-[40vh] max-w-2xl flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/30 p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Loading restaurant access…</h2>
        <p className="text-sm text-muted-foreground">We’re preparing your customers. This will only take a moment.</p>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Customers</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:text-base">
              <Badge variant="secondary" className="rounded-md font-medium">
                {currentRestaurantName}
              </Badge>
              <span className="text-muted-foreground/40">•</span>
              <span>View, filter, and export guest history.</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild size="sm" variant="outline" className="h-11 sm:h-9">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 sm:h-9"
              onClick={() => refetch()}
              disabled={isFetching || isLoading}
            >
              {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
            <ExportCustomersButton
              restaurantId={activeRestaurantId}
              restaurantName={currentRestaurantName}
              disabled={isLoading || !!error}
              sort={sort}
              filters={exportFilters}
            />
          </div>
        </header>

        <div className="sticky top-0 z-10 -mx-4 bg-background/80 px-4 py-2 backdrop-blur-md transition-all sm:-mx-6 sm:px-6 md:mx-0 md:rounded-xl md:border md:border-border/60 md:bg-card/80 md:px-3 md:shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 overflow-x-auto scrollbar-hide">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={lastVisit} onValueChange={handleLastVisitChange}>
                  <SelectTrigger className="h-9 w-[150px]">
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

                <Select value={marketingOptIn} onValueChange={handleMarketingChange}>
                  <SelectTrigger className="h-9 w-[140px]">
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

                <Select value={String(minBookings)} onValueChange={handleMinBookingsChange}>
                  <SelectTrigger className="h-9 w-[145px]">
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

                <Select value={sortOption} onValueChange={(value) => handleSortChange(value as SortOption)}>
                  <SelectTrigger className="h-9 w-[165px]">
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

                <Button type="button" variant="ghost" size="sm" disabled={!hasActiveFilters} onClick={handleClearFilters}>
                  <X className="mr-1 h-4 w-4" aria-hidden />
                  Clear
                </Button>
              </div>
            </div>

            <div className="relative w-full md:w-72 md:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
                placeholder="Search guests..."
                className="h-9 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 touch-manipulation"
                aria-label="Search customers"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {activeFilterBadges.length > 0 ? (
              activeFilterBadges.map((badge) => (
                <Badge key={badge.key} variant="secondary" className="flex items-center gap-1 py-1">
                  <span>{badge.label}</span>
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-muted-foreground transition hover:bg-background/60"
                    onClick={() => {
                      badge.onClear();
                      setPage(1);
                    }}
                    aria-label={`Remove ${badge.label} filter`}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Tip: search + min bookings to surface VIP guests fast.</span>
            )}

            {isFetching ? (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Updating results…
              </span>
            ) : null}
          </div>
        </div>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Unable to load customers</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{error.message}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-3">
          <CustomersTable customers={data?.items ?? []} isLoading={isLoading} hasActiveFilters={hasActiveFilters} />

          {pageInfo.total > 0 && (
            <Pagination
              page={pageInfo.page}
              pageSize={pageInfo.pageSize}
              total={pageInfo.total}
              isLoading={isFetching}
              onPageChange={handlePageChange}
            />
          )}
        </section>
      </main>
    </div>
  );
}

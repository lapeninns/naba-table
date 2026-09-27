'use client';

import {
  ChevronLeft,
  ChevronRight,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { DateTime } from 'luxon';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { SettingsSegmentedControl } from '@/components/features/restaurant-settings/shared/SettingsSegmentedControl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Heading, Text } from '@/components/ui/typography';
import { useOpsActiveMembership } from '@/contexts/ops-session';
import { useOpsDashboardData } from '@/hooks/ops/useOpsDashboardData';
import { cn } from '@/lib/utils';
import { formatDateReadable, getTodayInTimezone } from '@/lib/utils/datetime';

import { BookingsFilterBar } from './BookingsFilterBar';
import styles from './OpsBookingsPrintView.module.css';
import {
  buildOpsRunSheet,
  parseOpsBookingsPrintParams,
  type OpsBookingsPrintParams,
} from './opsBookingsPrintViewDomain';
import { OpsRunSheetList } from './OpsRunSheetList';
import { OpsRunSheetOptions } from './OpsRunSheetOptions';
import { OpsRunSheetPages, type RunSheetPagesContent } from './OpsRunSheetPages';
import { useOpsDashboardQueryState } from './useOpsDashboardQueryState';
import { useOpsRunSheetPreferences } from './useOpsRunSheetPreferences';

type OpsBookingsPrintViewProps = {
  params: OpsBookingsPrintParams;
};

/** The current time in the restaurant's timezone, updated on each minute boundary. */
function useMinuteClock(timezone: string | null): DateTime {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    let interval: number | undefined;
    const timeout = window.setTimeout(
      () => {
        setNowMs(Date.now());
        interval = window.setInterval(() => setNowMs(Date.now()), 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );
    return () => {
      window.clearTimeout(timeout);
      if (interval) window.clearInterval(interval);
    };
  }, []);
  return useMemo(() => {
    const now = DateTime.fromMillis(nowMs);
    return timezone ? now.setZone(timezone) : now;
  }, [nowMs, timezone]);
}

export function OpsBookingsPrintView({ params }: OpsBookingsPrintViewProps) {
  const membership = useOpsActiveMembership();
  const restaurantId = membership?.restaurantId ?? null;
  const restaurantName = membership?.restaurantName ?? 'Restaurant';
  const pathname = usePathname();

  const { parsedDate } = parseOpsBookingsPrintParams(params);
  const {
    filter,
    searchQuery,
    deferredSearchQuery,
    selectedDate,
    sortKey,
    sortDir,
    handleSelectFilter,
    handleSelectDate,
    handleSearchChange,
    handleClearFilters,
    handleSortKeyChange,
    handleSortDirChange,
  } = useOpsDashboardQueryState({ initialDate: parsedDate });

  const summaryQuery = useOpsDashboardData({ restaurantId, targetDate: selectedDate });
  const { summary, isError, isFetching, dataUpdatedAt, refetch } = summaryQuery;
  const timezone = summary?.timezone ?? null;
  const now = useMinuteClock(timezone);
  const today = timezone ? getTodayInTimezone(timezone) : now.toISODate();
  const activeDate = selectedDate ?? summary?.date ?? today;

  const {
    preferences,
    update: updatePreferences,
    reset: resetPreferences,
  } = useOpsRunSheetPreferences();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [layout, setLayout] = useState({ pageCount: 1, scale: 1 });

  const sheet = useMemo(
    () =>
      summary && today
        ? buildOpsRunSheet({
            summary,
            filter,
            searchQuery: deferredSearchQuery,
            sortKey,
            sortDir,
            groupMode: preferences.groupMode,
            now,
            today,
          })
        : null,
    // `now` changes every minute; lateness is the only thing it affects.
    [summary, filter, deferredSearchQuery, sortKey, sortDir, preferences.groupMode, now, today],
  );

  const readableDate = formatDateReadable(activeDate ?? '', timezone ?? '') || 'Today';

  useEffect(() => {
    document.title = `Run sheet · ${readableDate} · Nabatable`;
  }, [readableDate]);

  const shiftDate = useCallback(
    (days: number) => {
      if (!activeDate) return;
      const next = DateTime.fromISO(activeDate).plus({ days }).toISODate();
      if (next) handleSelectDate(next);
    },
    [activeDate, handleSelectDate],
  );

  const asOfLabel =
    summary && dataUpdatedAt
      ? DateTime.fromMillis(dataUpdatedAt)
          .setZone(summary.timezone)
          .setLocale('en-GB')
          .toFormat('HH:mm ZZZZ')
      : null;
  const printedLabel = now.setLocale('en-GB').toFormat('d LLL yyyy, HH:mm');
  const dashboardHref = `${(pathname ?? '/app/dashboard/print').replace(/\/print$/, '')}${
    selectedDate ? `?date=${selectedDate}` : ''
  }`;

  if (!restaurantId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-2">
          <Heading variant="title" as="h1">
            No restaurant access
          </Heading>
          <Text variant="caption">Sign in with an account that has ops access.</Text>
        </div>
      </div>
    );
  }

  const hasRows = Boolean(sheet && sheet.matchingCount > 0);
  const isLoadingSheet = !summary && !isError;
  const canPrint = hasRows && !isLoadingSheet;
  const printLabel = canPrint
    ? `Print ${layout.pageCount} ${layout.pageCount === 1 ? 'page' : 'pages'}`
    : 'Print sheet';

  let content: RunSheetPagesContent;
  if (!sheet) {
    content = { kind: 'loading' };
  } else if (sheet.dayBookingCount === 0) {
    content = {
      kind: 'message',
      sheet,
      node: (
        <div className={styles.state}>
          <h3>No bookings on {readableDate}</h3>
          <p>There is nothing to print for this date.</p>
        </div>
      ),
    };
  } else if (!hasRows) {
    content = {
      kind: 'message',
      sheet,
      node: (
        <div className={styles.state}>
          <h3>No bookings match these filters</h3>
          <p>
            Filter {sheet.criteria.filterLabel}
            {sheet.criteria.search ? ` and search “${sheet.criteria.search}”` : ''} returns no
            bookings for this date.
          </p>
          <Button
            type="button"
            variant="outline"
            className={styles.screenOnly}
            onClick={handleClearFilters}
          >
            Show all bookings
          </Button>
        </div>
      ),
    };
  } else {
    content = { kind: 'sheet', sheet };
  }

  const optionsForm = (
    <OpsRunSheetOptions
      preferences={preferences}
      sortKey={sortKey}
      sortDir={sortDir}
      onSortKeyChange={handleSortKeyChange}
      onSortDirChange={handleSortDirChange}
      onChange={updatePreferences}
      onReset={resetPreferences}
    />
  );

  const printButton = (className?: string) => (
    <Button type="button" className={className} disabled={!canPrint} onClick={() => window.print()}>
      <Printer aria-hidden="true" />
      {printLabel}
    </Button>
  );

  return (
    <div className="@container mx-auto w-full max-w-[1600px] px-4 pb-12 pt-4 md:px-6">
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={dashboardHref}>Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Run sheet</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-[22px]">
            Bookings run sheet
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {restaurantName} · Review the list, then print it for the floor team.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          {asOfLabel ? (
            <span aria-live="polite">
              <span className="max-[420px]:hidden">Data as of </span>
              <span className="font-mono tabular-nums text-foreground">{asOfLabel}</span>
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw
              aria-hidden="true"
              className={cn(isFetching && 'motion-safe:animate-spin')}
            />
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </header>

      {isError && summary ? (
        <Alert variant="warning" className="mb-3">
          <AlertTitle>Couldn’t refresh bookings</AlertTitle>
          <AlertDescription>
            The sheet shows data as of {asOfLabel}. Check the connection, then refresh.
          </AlertDescription>
        </Alert>
      ) : null}

      <section
        aria-label="Sheet date and search"
        className="mb-3 flex flex-wrap items-center gap-2 md:gap-3"
      >
        <div className="flex w-full items-center gap-1 md:w-auto">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous day"
            onClick={() => shiftDate(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Label className="block flex-1 md:flex-none">
            <span className="sr-only">Service date</span>
            <Input
              type="date"
              value={activeDate ?? ''}
              onChange={(event) => {
                if (event.target.value) handleSelectDate(event.target.value);
              }}
              className="h-9 min-w-[150px] font-medium tabular-nums"
            />
          </Label>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next day"
            onClick={() => shiftDate(1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!today || activeDate === today}
            onClick={() => today && handleSelectDate(today)}
          >
            Today
          </Button>
        </div>
        <Label className="relative block w-full font-normal md:max-w-[360px] md:flex-[1_1_240px]">
          <span className="sr-only">Search by guest name or booking reference</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Guest name or reference"
            autoComplete="off"
            className="h-9 pl-8"
          />
        </Label>
        <div className="grid w-full grid-cols-[1fr_1.4fr] gap-2 md:hidden">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            aria-expanded={optionsOpen}
            onClick={() => setOptionsOpen(true)}
          >
            <SlidersHorizontal aria-hidden="true" />
            Options
          </Button>
          {printButton('h-11')}
        </div>
        <span className="hidden flex-1 md:block" />
        <Button
          type="button"
          variant="outline"
          className="hidden md:inline-flex @[960px]:hidden"
          aria-expanded={optionsOpen}
          onClick={() => setOptionsOpen(true)}
        >
          <SlidersHorizontal aria-hidden="true" />
          Sheet options
        </Button>
        {printButton('hidden md:inline-flex')}
      </section>

      <BookingsFilterBar value={filter} onChange={handleSelectFilter} counts={sheet?.counts} />

      <div className="mt-3 grid items-start gap-6 @[960px]:grid-cols-[272px_minmax(0,1fr)]">
        <aside
          aria-labelledby="run-sheet-options-title"
          className="sticky top-4 hidden rounded-lg border border-border bg-background @[960px]:block"
        >
          <h2
            id="run-sheet-options-title"
            className="border-b border-border px-4 py-3.5 text-sm font-semibold"
          >
            Sheet options
          </h2>
          <div className="px-4 py-4">{optionsForm}</div>
        </aside>

        <main
          id="run-sheet-preview"
          className={cn('relative min-w-0', preferences.view === 'list' && styles.listMode)}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted-foreground">
            <span aria-live="polite">
              {isLoadingSheet ? (
                'Preparing pages…'
              ) : (
                <>
                  A4 {preferences.paper} ·{' '}
                  <b className="font-semibold text-foreground">
                    {layout.pageCount} {layout.pageCount === 1 ? 'page' : 'pages'}
                  </b>{' '}
                  · {sheet?.matchingCount ?? 0}{' '}
                  {sheet?.matchingCount === 1 ? 'booking' : 'bookings'}
                </>
              )}
            </span>
            <span className={cn(preferences.view === 'list' && 'max-[819px]:hidden')}>
              {layout.scale < 1
                ? `Preview scaled to ${Math.round(layout.scale * 100)}% to fit · prints at full size`
                : 'Shown at full size'}
            </span>
            <SettingsSegmentedControl
              className="w-full min-[820px]:hidden"
              itemClassName="flex-1"
              size="sm"
              ariaLabel="Preview as"
              value={preferences.view}
              onValueChange={(view) => updatePreferences({ view })}
              options={[
                { value: 'pages', label: 'A4 pages' },
                { value: 'list', label: 'Booking list' },
              ]}
            />
          </div>

          {isError && !summary ? (
            <Alert variant="destructive">
              <AlertTitle>Couldn’t load bookings</AlertTitle>
              <AlertDescription>
                <p>Check the connection, then try again.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => void refetch()}
                >
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <OpsRunSheetPages
                content={content}
                preferences={preferences}
                restaurantName={restaurantName}
                readableDate={readableDate}
                printedLabel={printedLabel}
                asOfLabel={asOfLabel}
                onLayoutChange={setLayout}
              />
              <div className={styles.listView}>
                {content.kind === 'sheet' ? (
                  <OpsRunSheetList sheet={content.sheet} preferences={preferences} />
                ) : (
                  <p className="px-4 py-10 text-center text-muted-foreground">
                    {content.kind === 'loading' ? 'Loading bookings…' : 'No bookings to show.'}
                  </p>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      <Sheet open={optionsOpen} onOpenChange={setOptionsOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[380px]">
          <SheetHeader>
            <SheetTitle>Sheet options</SheetTitle>
            <SheetDescription className="sr-only">
              Choose how the run sheet is sorted, grouped and laid out on paper.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{optionsForm}</div>
        </SheetContent>
      </Sheet>

    </div>
  );
}

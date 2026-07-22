'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Heading, Text } from '@/components/ui/typography';
import { useOpsActiveMembership } from '@/contexts/ops-session';
import { useOpsTodaySummary } from '@/hooks/ops/useOpsTodaySummary';
import { formatDateReadable } from '@/lib/utils/datetime';

import styles from './OpsBookingsPrintView.module.css';
import {
  buildOpsBookingsPrintTableRow,
  buildOpsBookingsPrintViewState,
  getOpsBookingsPrintNow,
  parseOpsBookingsPrintParams,
  shouldAllowPrintTableAssignments,
  type OpsBookingsPrintParams,
} from './opsBookingsPrintViewDomain';

type OpsBookingsPrintViewProps = {
  params: OpsBookingsPrintParams;
};

export function OpsBookingsPrintView({ params }: OpsBookingsPrintViewProps) {
  const membership = useOpsActiveMembership();
  const restaurantId = membership?.restaurantId ?? null;
  const restaurantName = membership?.restaurantName ?? 'Restaurant';
  const { filter, parsedDate, searchQuery, sortDir, sortKey, targetDate } =
    parseOpsBookingsPrintParams(params);

  const summaryQuery = useOpsTodaySummary({ restaurantId, targetDate: parsedDate });
  const summary = summaryQuery.data ?? null;
  const [hasPrinted, setHasPrinted] = useState(false);
  const isSummaryMismatch = Boolean(targetDate && summary && summary.date !== targetDate);
  const isSummaryReady = Boolean(summary && !isSummaryMismatch);

  useEffect(() => {
    if (!summary || !isSummaryReady || hasPrinted || summaryQuery.isFetching) return;
    const handle = window.setTimeout(() => {
      window.print();
      setHasPrinted(true);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [hasPrinted, isSummaryReady, summary, summaryQuery.isFetching]);

  useEffect(() => {
    if (!summary || !isSummaryReady) return;
    const readableDate = formatDateReadable(summary.date, summary.timezone);
    document.title = `Print Bookings - ${readableDate}`;
  }, [isSummaryReady, summary]);

  const allowTableAssignments = useMemo(() => {
    return shouldAllowPrintTableAssignments(summary, isSummaryReady);
  }, [isSummaryReady, summary]);

  const now = useMemo(() => getOpsBookingsPrintNow(summary), [summary]);

  const printViewState = useMemo(
    () =>
      summary && isSummaryReady
        ? buildOpsBookingsPrintViewState({
            allowTableAssignments,
            filter,
            now,
            searchQuery,
            sortDir,
            sortKey,
            summary,
          })
        : null,
    [allowTableAssignments, filter, isSummaryReady, now, searchQuery, sortDir, sortKey, summary],
  );

  if (!restaurantId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-2">
          <Heading variant="title" as="h1">No restaurant access</Heading>
          <Text variant="caption">
            Sign in with an account that has ops access.
          </Text>
        </div>
      </div>
    );
  }

  if (summaryQuery.isLoading || (isSummaryMismatch && summaryQuery.isFetching)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-2">
          <Heading variant="title" as="h1">Preparing print view…</Heading>
          <Text variant="caption">
            Fetching bookings{targetDate ? ` for ${targetDate}` : ''}.
          </Text>
        </div>
      </div>
    );
  }

  if (summaryQuery.isError || !summary || isSummaryMismatch) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-2">
          <Heading variant="title" as="h1">Unable to load bookings</Heading>
          <Text variant="caption">
            Please refresh the page and try again{targetDate ? ` for ${targetDate}` : ''}.
          </Text>
        </div>
      </div>
    );
  }

  if (!printViewState) {
    return null;
  }

  const { filterLabel, readableDate, sortDirLabel, sortedBookings, sortLabel } = printViewState;

  return (
    <div id="ops-print-root" className={styles.printRoot}>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>Bookings print list</h1>
            <p className={styles.subtitle}>
              {restaurantName} - {readableDate}
            </p>
          </div>
          <div className={`${styles.printControls} ${styles.headerActions}`}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              aria-label="Print bookings"
            >
              Print
            </Button>
          </div>
        </header>

        <div className={styles.metaRow}>
          <span className={styles.metaChip}>Filter: {filterLabel}</span>
          <span className={styles.metaChip}>
            Sort: {sortLabel} ({sortDirLabel})
          </span>
          {searchQuery ? (
            <span className={styles.metaChip}>
              Search: <q>{searchQuery}</q>
            </span>
          ) : null}
        </div>

        {sortedBookings.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No bookings match the current filters.</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <Table className={styles.table}>
              <TableHeader>
                <TableRow>
                  <TableHead className={`${styles.th} ${styles.nameCell}`}>Name</TableHead>
                  <TableHead className={`${styles.th} ${styles.tableCell}`}>Table #</TableHead>
                  <TableHead className={`${styles.th} ${styles.notesCell}`}>Notes</TableHead>
                  <TableHead className={`${styles.th} ${styles.partyCell}`}>Party</TableHead>
                  <TableHead className={`${styles.th} ${styles.timeCell}`}>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBookings.map((booking) => {
                  const row = buildOpsBookingsPrintTableRow(booking, summary.timezone);

                  return (
                    <TableRow key={row.id} className={styles.row}>
                      <TableCell className={`${styles.td} ${styles.nameCell}`}>
                        {row.nameLabel}
                      </TableCell>
                      <TableCell className={`${styles.td} ${styles.tableCell}`}>
                        {row.tableLabel}
                      </TableCell>
                      <TableCell className={`${styles.td} ${styles.notesCell}`}>
                        <p className={styles.notesCopy}>{row.notesLabel}</p>
                      </TableCell>
                      <TableCell className={`${styles.td} ${styles.partyCell}`}>
                        {row.partySize}
                      </TableCell>
                      <TableCell className={`${styles.td} ${styles.timeCell}`}>
                        {row.timeLabel}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

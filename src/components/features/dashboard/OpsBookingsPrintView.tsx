'use client';

import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useOpsActiveMembership } from '@/contexts/ops-session';
import { useOpsTodaySummary } from '@/hooks/ops/useOpsTodaySummary';
import { formatDateReadable, formatTimeRange, getTodayInTimezone } from '@/lib/utils/datetime';
import { sanitizeDateParam } from '@/utils/ops/dashboard';
import { getOpsBookingActionRequirements, getOpsBookingTemporalInfo } from '@/utils/ops/todayBookingsAttention';

import { flattenTableAssignments } from './booking-details/utils';
import { type BookingFilter } from './BookingsFilterBar';
import styles from './OpsBookingsPrintView.module.css';

import type { OpsTodayBooking } from '@/types/ops';

const FILTER_LABELS: Record<BookingFilter, string> = {
  all: 'All',
  upcoming: 'Upcoming',
  seated: 'Seated',
  finished: 'Finished',
  completed: 'Completed',
  no_show: 'No show',
  attention: 'Needs attention',
};

const FILTER_VALUES: BookingFilter[] = [
  'all',
  'upcoming',
  'seated',
  'finished',
  'completed',
  'no_show',
  'attention',
];

type BookingSortKey = 'time' | 'party' | 'name';
type BookingSortDir = 'asc' | 'desc';

type PrintParams = {
  date?: string | string[];
  filter?: string | string[];
  search?: string | string[];
  sortKey?: string | string[];
  sortDir?: string | string[];
};

type OpsBookingsPrintViewProps = {
  params: PrintParams;
};

const UPCOMING_STATUSES = new Set<OpsTodayBooking['status']>([
  'confirmed',
  'PRIORITY_WAITLIST',
  'pending',
  'pending_allocation',
]);

const COMPLETED_STATUSES = new Set<OpsTodayBooking['status']>([
  'completed',
  'cancelled',
  'no_show',
]);

const SORT_KEYS: BookingSortKey[] = ['time', 'party', 'name'];
const SORT_DIRS: BookingSortDir[] = ['asc', 'desc'];

const pickFirst = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

const parseFilter = (value?: string | string[]): BookingFilter => {
  const raw = pickFirst(value);
  if (raw && FILTER_VALUES.includes(raw as BookingFilter)) {
    return raw as BookingFilter;
  }
  return 'all';
};

const parseSortKey = (value?: string | string[]): BookingSortKey => {
  const raw = pickFirst(value);
  if (raw && SORT_KEYS.includes(raw as BookingSortKey)) {
    return raw as BookingSortKey;
  }
  return 'time';
};

const parseSortDir = (value?: string | string[]): BookingSortDir => {
  const raw = pickFirst(value);
  if (raw && SORT_DIRS.includes(raw as BookingSortDir)) {
    return raw as BookingSortDir;
  }
  return 'asc';
};

function compareBookings(
  a: OpsTodayBooking,
  b: OpsTodayBooking,
  sortKey: BookingSortKey,
  sortDir: BookingSortDir,
) {
  let comparison = 0;

  if (sortKey === 'time') {
    const tA = a.startTime ? new Date(`1970-01-01T${a.startTime}`).getTime() : Number.MAX_SAFE_INTEGER;
    const tB = b.startTime ? new Date(`1970-01-01T${b.startTime}`).getTime() : Number.MAX_SAFE_INTEGER;
    comparison = tA - tB;
  } else if (sortKey === 'party') {
    comparison = a.partySize - b.partySize;
  } else if (sortKey === 'name') {
    comparison = a.customerName.localeCompare(b.customerName);
  }

  return sortDir === 'asc' ? comparison : -comparison;
}

function sortBookings(
  bookings: OpsTodayBooking[],
  sortKey: BookingSortKey,
  sortDir: BookingSortDir,
) {
  return [...bookings].sort((a, b) => compareBookings(a, b, sortKey, sortDir));
}

function getStatusGroup(status: OpsTodayBooking['status']) {
  if (status === 'checked_in') return 0;
  if (UPCOMING_STATUSES.has(status)) return 1;
  if (COMPLETED_STATUSES.has(status)) return 2;
  return 1;
}

function sortBookingsGrouped(
  bookings: OpsTodayBooking[],
  sortKey: BookingSortKey,
  sortDir: BookingSortDir,
) {
  return [...bookings].sort((a, b) => {
    const groupA = getStatusGroup(a.status);
    const groupB = getStatusGroup(b.status);
    if (groupA !== groupB) {
      return groupA - groupB;
    }
    return compareBookings(a, b, sortKey, sortDir);
  });
}

function buildTableLabel(booking: OpsTodayBooking) {
  const tables = flattenTableAssignments(booking.tableAssignments);
  if (tables.length === 0) return 'Unassigned';
  const numbers = tables.map((table) => table.tableNumber).filter(Boolean);
  const unique = Array.from(new Set(numbers));
  return unique.join(', ');
}

export function OpsBookingsPrintView({ params }: OpsBookingsPrintViewProps) {
  const membership = useOpsActiveMembership();
  const restaurantId = membership?.restaurantId ?? null;
  const restaurantName = membership?.restaurantName ?? 'Restaurant';
  const parsedDate = sanitizeDateParam(pickFirst(params.date) ?? null);
  const filter = parseFilter(params.filter);
  const searchQuery = (pickFirst(params.search) ?? '').trim();
  const sortKey = parseSortKey(params.sortKey);
  const sortDir = parseSortDir(params.sortDir);
  const targetDate = parsedDate ?? null;

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
    if (!summary || !isSummaryReady) return true;
    const today = getTodayInTimezone(summary.timezone);
    return summary.date >= today;
  }, [isSummaryReady, summary]);

  const now = useMemo(
    () => (summary ? DateTime.now().setZone(summary.timezone) : DateTime.now()),
    [summary],
  );

  const filteredBookings = useMemo(() => {
    if (!summary || !isSummaryReady) return [];
    let result = summary.bookings;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((booking) =>
        booking.customerName.toLowerCase().includes(q) ||
        (booking.reference && booking.reference.toLowerCase().includes(q)),
      );
    }

    if (filter === 'all') return result;

    if (filter === 'upcoming') {
      return result.filter(
        (booking) =>
          booking.status === 'confirmed' ||
          booking.status === 'PRIORITY_WAITLIST' ||
          booking.status === 'pending' ||
          booking.status === 'pending_allocation',
      );
    }

    if (filter === 'seated') {
      return result.filter((booking) => booking.status === 'checked_in');
    }

    if (filter === 'finished' || filter === 'completed') {
      return result.filter((booking) => ['completed', 'cancelled', 'no_show'].includes(booking.status));
    }

    if (filter === 'no_show') {
      return result.filter((booking) => booking.status === 'no_show');
    }

    return result.filter((booking) => {
      const temporalInfo = getOpsBookingTemporalInfo(booking, summary, now);
      const requirements = getOpsBookingActionRequirements({
        booking,
        temporalInfo,
        now,
        statusForActions: booking.status,
        allowTableAssignments,
        hasAssignmentHandlers: true,
      });
      return requirements.needsAttention;
    });
  }, [allowTableAssignments, filter, isSummaryReady, now, searchQuery, summary]);

  const sortedBookings = useMemo(() => {
    if (filter === 'all') {
      return sortBookingsGrouped(filteredBookings, sortKey, sortDir);
    }
    return sortBookings(filteredBookings, sortKey, sortDir);
  }, [filter, filteredBookings, sortDir, sortKey]);

  if (!restaurantId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-semibold text-foreground">No restaurant access</h1>
          <p className="text-sm text-muted-foreground">Sign in with an account that has ops access.</p>
        </div>
      </div>
    );
  }

  if (summaryQuery.isLoading || (isSummaryMismatch && summaryQuery.isFetching)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-semibold text-foreground">Preparing print view...</h1>
          <p className="text-sm text-muted-foreground">
            Fetching bookings{targetDate ? ` for ${targetDate}` : ''}.
          </p>
        </div>
      </div>
    );
  }

  if (summaryQuery.isError || !summary || isSummaryMismatch) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-semibold text-foreground">Unable to load bookings</h1>
          <p className="text-sm text-muted-foreground">
            Please refresh the page and try again{targetDate ? ` for ${targetDate}` : ''}.
          </p>
        </div>
      </div>
    );
  }

  const readableDate = formatDateReadable(summary.date, summary.timezone);
  const filterLabel = FILTER_LABELS[filter] ?? 'All';
  const sortLabel = sortKey === 'time' ? 'Time' : sortKey === 'party' ? 'Party size' : 'Guest name';
  const sortDirLabel = sortDir === 'asc' ? 'Ascending' : 'Descending';

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
            <Button variant="outline" size="sm" onClick={() => window.print()} aria-label="Print bookings">
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
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={`${styles.th} ${styles.nameCell}`}>Name</th>
                  <th className={`${styles.th} ${styles.tableCell}`}>Table #</th>
                  <th className={`${styles.th} ${styles.notesCell}`}>Notes</th>
                  <th className={`${styles.th} ${styles.partyCell}`}>Party</th>
                  <th className={`${styles.th} ${styles.timeCell}`}>Time</th>
                </tr>
              </thead>
              <tbody>
                {sortedBookings.map((booking) => {
                  const tableLabel = buildTableLabel(booking);
                  const nameLabel = booking.customerName?.trim() || 'Walk-in Guest';
                  const notesLabel = booking.notes?.trim() || '-';
                  const timeLabel = formatTimeRange(booking.startTime, booking.endTime, summary.timezone);

                  return (
                    <tr key={booking.id} className={styles.row}>
                      <td className={`${styles.td} ${styles.nameCell}`}>{nameLabel}</td>
                      <td className={`${styles.td} ${styles.tableCell}`}>{tableLabel}</td>
                      <td className={`${styles.td} ${styles.notesCell}`}>
                        <p className={styles.notesCopy}>{notesLabel}</p>
                      </td>
                      <td className={`${styles.td} ${styles.partyCell}`}>{booking.partySize}</td>
                      <td className={`${styles.td} ${styles.timeCell}`}>{timeLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

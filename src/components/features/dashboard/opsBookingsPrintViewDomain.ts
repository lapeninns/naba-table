
import {
  NON_ACTIVE_BOOKING_STATUSES,
  normalizeServicePeriodKey,
} from '@/lib/ops/daily-booking-summary';
import { formatDateReadable, getTodayInTimezone } from '@/lib/utils/datetime';
import { sanitizeDateParam } from '@/utils/ops/dashboard';
import {
  OPS_CHECK_IN_ELIGIBLE_STATUSES,
  getOpsBookingTemporalInfo,
} from '@/utils/ops/todayBookingsAttention';

import { flattenTableAssignments } from './booking-details/utils';
import {
  getBookingFilterLabel,
  getBookingTabCounts,
  matchesBookingFilter,
  normalizeBookingFilter,
  type BookingTabCounts,
} from './bookingFilters';

import type { BookingFilter } from './BookingsFilterBar';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';
import type { DateTime } from 'luxon';

export type BookingSortKey = 'time' | 'party' | 'name';
export type BookingSortDir = 'asc' | 'desc';

export type OpsBookingsPrintParams = {
  date?: string | string[];
  filter?: string | string[];
  search?: string | string[];
  sortKey?: string | string[];
  sortDir?: string | string[];
};

export type ParsedOpsBookingsPrintParams = {
  filter: BookingFilter;
  parsedDate: string | null;
  searchQuery: string;
  sortDir: BookingSortDir;
  sortKey: BookingSortKey;
  targetDate: string | null;
};

/* ─── sheet preferences (per device, stored in localStorage) ─────────────── */

export type RunSheetGroupMode = 'service' | 'status' | 'none';
export type RunSheetPaper = 'portrait' | 'landscape';
export type RunSheetDensity = 'comfortable' | 'compact';
export type RunSheetView = 'pages' | 'list';
export type RunSheetColumnToggle = 'tick' | 'status' | 'diet' | 'notes' | 'ref' | 'phone';

export type RunSheetPreferences = {
  groupMode: RunSheetGroupMode;
  paper: RunSheetPaper;
  density: RunSheetDensity;
  view: RunSheetView;
  columns: Record<RunSheetColumnToggle, boolean>;
};

export const RUN_SHEET_COLUMN_TOGGLES: readonly RunSheetColumnToggle[] = [
  'tick',
  'status',
  'diet',
  'notes',
  'ref',
  'phone',
];

export const DEFAULT_RUN_SHEET_PREFERENCES: RunSheetPreferences = {
  groupMode: 'service',
  paper: 'portrait',
  density: 'comfortable',
  view: 'pages',
  // A printed phone number leaves the system on paper, so it is opt-in.
  columns: { tick: true, status: true, diet: true, notes: true, ref: true, phone: false },
};

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Validates a stored preferences value field by field; anything unrecognised falls back. */
export function parseRunSheetPreferences(raw: unknown): RunSheetPreferences {
  const defaults = DEFAULT_RUN_SHEET_PREFERENCES;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...defaults, columns: { ...defaults.columns } };
  }

  const value = raw as Record<string, unknown>;
  const storedColumns =
    value.columns && typeof value.columns === 'object' && !Array.isArray(value.columns)
      ? (value.columns as Record<string, unknown>)
      : {};
  const columns = { ...defaults.columns };
  for (const key of RUN_SHEET_COLUMN_TOGGLES) {
    const stored = storedColumns[key];
    if (typeof stored === 'boolean') columns[key] = stored;
  }

  return {
    groupMode: pickEnum(value.groupMode, ['service', 'status', 'none'], defaults.groupMode),
    paper: pickEnum(value.paper, ['portrait', 'landscape'], defaults.paper),
    density: pickEnum(value.density, ['comfortable', 'compact'], defaults.density),
    view: pickEnum(value.view, ['pages', 'list'], defaults.view),
    columns,
  };
}

/* ─── URL params ──────────────────────────────────────────────────────────── */

const SORT_KEYS: BookingSortKey[] = ['time', 'party', 'name'];
const SORT_DIRS: BookingSortDir[] = ['asc', 'desc'];

function pickFirst(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseOpsBookingsPrintParams(
  params: OpsBookingsPrintParams,
): ParsedOpsBookingsPrintParams {
  const parsedDate = sanitizeDateParam(pickFirst(params.date) ?? null);

  return {
    filter: normalizeBookingFilter(pickFirst(params.filter)) ?? 'all',
    parsedDate,
    searchQuery: (pickFirst(params.search) ?? '').trim(),
    sortDir: pickEnum(pickFirst(params.sortDir), SORT_DIRS, 'asc'),
    sortKey: pickEnum(pickFirst(params.sortKey), SORT_KEYS, 'time'),
    targetDate: parsedDate ?? null,
  };
}

export function shouldAllowPrintTableAssignments(
  summary: OpsTodayBookingsSummary | null,
  isSummaryReady: boolean,
): boolean {
  if (!summary || !isSummaryReady) return true;
  const today = getTodayInTimezone(summary.timezone);
  return summary.date >= today;
}

/* ─── rows ────────────────────────────────────────────────────────────────── */

/** Minutes past the start time before an unseated booking is flagged late. */
export const RUN_SHEET_LATE_AFTER_MINUTES = 10;

export type RunSheetCategory = 'seated' | 'upcoming' | 'finished';
export type RunSheetStatusTone = 'seated' | 'confirmed' | 'pending' | 'done';
export type RunSheetServiceKey = ReturnType<typeof normalizeServicePeriodKey>;

export type RunSheetRow = {
  id: string;
  reference: string | null;
  guestLabel: string;
  phone: string | null;
  startLabel: string;
  endLabel: string | null;
  startMinutes: number | null;
  endMinutes: number | null;
  partySize: number;
  tableNumbers: string[];
  tableSections: string[];
  isUnassigned: boolean;
  category: RunSheetCategory;
  statusLabel: string;
  statusTone: RunSheetStatusTone;
  lateMinutes: number | null;
  allergies: string[];
  dietary: string[];
  notes: string | null;
  serviceKey: RunSheetServiceKey;
  /** Counts towards covers: not cancelled and not a no-show. */
  isActive: boolean;
};

const STATUS_PRESENTATION: Record<
  OpsTodayBooking['status'],
  { label: string; tone: RunSheetStatusTone }
> = {
  checked_in: { label: 'Seated', tone: 'seated' },
  confirmed: { label: 'Confirmed', tone: 'confirmed' },
  pending: { label: 'Pending', tone: 'pending' },
  pending_allocation: { label: 'Awaiting table', tone: 'pending' },
  PRIORITY_WAITLIST: { label: 'Priority waitlist', tone: 'pending' },
  completed: { label: 'Finished', tone: 'done' },
  cancelled: { label: 'Cancelled', tone: 'done' },
  no_show: { label: 'No show', tone: 'done' },
};

const FINISHED_STATUSES = new Set<OpsTodayBooking['status']>(['completed', 'cancelled', 'no_show']);

function toCategory(status: OpsTodayBooking['status']): RunSheetCategory {
  if (status === 'checked_in') return 'seated';
  return FINISHED_STATUSES.has(status) ? 'finished' : 'upcoming';
}

const TIME_PATTERN = /^(\d{2}):(\d{2})/;

function parseClock(value: string | null): { label: string; minutes: number } | null {
  const match = value ? TIME_PATTERN.exec(value) : null;
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return { label: `${match[1]}:${match[2]}`, minutes: hours * 60 + minutes };
}

function cleanList(values: string[] | null | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function unique(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.map((value) => value?.trim() ?? '').filter(Boolean)));
}

export function buildRunSheetRow(
  booking: OpsTodayBooking,
  { summary, now, isToday }: { summary: OpsTodayBookingsSummary; now: DateTime; isToday: boolean },
): RunSheetRow {
  const tables = flattenTableAssignments(booking.tableAssignments);
  const category = toCategory(booking.status);
  const presentation = STATUS_PRESENTATION[booking.status] ?? {
    label: booking.status,
    tone: 'confirmed' as const,
  };
  const start = parseClock(booking.startTime);
  const end = parseClock(booking.endTime);

  let lateMinutes: number | null = null;
  if (isToday && OPS_CHECK_IN_ELIGIBLE_STATUSES.includes(booking.status)) {
    const { diffMinutes } = getOpsBookingTemporalInfo(booking, summary, now);
    const minutesPast = diffMinutes === null ? 0 : Math.floor(-diffMinutes);
    if (minutesPast > RUN_SHEET_LATE_AFTER_MINUTES) lateMinutes = minutesPast;
  }

  const tableNumbers = unique(tables.map((entry) => entry.tableNumber));

  return {
    id: booking.id,
    reference: booking.reference?.trim() || null,
    guestLabel: booking.customerName?.trim() || 'Walk-in guest',
    phone: booking.customerPhone?.trim() || null,
    startLabel: start?.label ?? 'TBC',
    endLabel: end?.label ?? null,
    startMinutes: start?.minutes ?? null,
    endMinutes: end?.minutes ?? null,
    partySize: booking.partySize,
    tableNumbers,
    tableSections: unique(tables.map((entry) => entry.section)),
    isUnassigned: tableNumbers.length === 0 && category !== 'finished',
    category,
    statusLabel: presentation.label,
    statusTone: presentation.tone,
    lateMinutes,
    allergies: cleanList(booking.allergies),
    dietary: cleanList(booking.dietaryRestrictions),
    notes: booking.notes?.trim() || null,
    serviceKey: normalizeServicePeriodKey(booking.bookingType),
    isActive: !NON_ACTIVE_BOOKING_STATUSES.has(booking.status),
  };
}

/* ─── sheet ───────────────────────────────────────────────────────────────── */

export type RunSheetGroup = {
  key: string;
  label: string | null;
  spanLabel: string | null;
  rows: RunSheetRow[];
  covers: number;
};

export type RunSheetStats = {
  bookings: number;
  covers: number;
  lunchCovers: number;
  dinnerCovers: number;
  allergyFlags: number;
  unassigned: number;
};

export type RunSheetCriteria = {
  filterLabel: string;
  sortLabel: string;
  sortDirLabel: string;
  search: string;
};

export type OpsRunSheet = {
  readableDate: string;
  groups: RunSheetGroup[];
  stats: RunSheetStats;
  counts: BookingTabCounts;
  criteria: RunSheetCriteria;
  /** Bookings on the day before search and filter. */
  dayBookingCount: number;
  /** Bookings on the sheet after search and filter. */
  matchingCount: number;
};

const SORT_LABELS: Record<BookingSortKey, string> = {
  time: 'time',
  party: 'party size',
  name: 'guest name',
};

export const RUN_SHEET_SORT_DIR_LABELS: Record<BookingSortKey, Record<BookingSortDir, string>> = {
  time: { asc: 'Earliest first', desc: 'Latest first' },
  party: { asc: 'Smallest first', desc: 'Largest first' },
  name: { asc: 'A to Z', desc: 'Z to A' },
};

const SERVICE_GROUPS: { key: RunSheetServiceKey; label: string }[] = [
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'other', label: 'Other bookings' },
];

const STATUS_GROUPS: { key: RunSheetCategory; label: string }[] = [
  { key: 'seated', label: 'Seated' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'finished', label: 'Finished' },
];

const coversOf = (rows: RunSheetRow[]) =>
  rows.reduce((total, row) => total + (row.isActive ? row.partySize : 0), 0);

function formatClock(minutes: number) {
  const clamped = Math.max(0, Math.min(minutes, 24 * 60 - 1));
  const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
  const mm = String(clamped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function spanOf(rows: RunSheetRow[]): string | null {
  const starts = rows.flatMap((row) => (row.startMinutes === null ? [] : [row.startMinutes]));
  if (starts.length === 0) return null;
  const ends = rows.flatMap((row) => [row.endMinutes ?? row.startMinutes ?? 0]);
  return `${formatClock(Math.min(...starts))}–${formatClock(Math.max(...ends))}`;
}

function compareRows(a: RunSheetRow, b: RunSheetRow, sortKey: BookingSortKey) {
  const byTime =
    (a.startMinutes ?? Number.MAX_SAFE_INTEGER) - (b.startMinutes ?? Number.MAX_SAFE_INTEGER);
  if (sortKey === 'party') return a.partySize - b.partySize || byTime;
  if (sortKey === 'name') return a.guestLabel.localeCompare(b.guestLabel, 'en-GB') || byTime;
  return byTime;
}

function toGroup(
  key: string,
  label: string | null,
  rows: RunSheetRow[],
  withSpan: boolean,
): RunSheetGroup {
  return { key, label, spanLabel: withSpan ? spanOf(rows) : null, rows, covers: coversOf(rows) };
}

export function buildOpsRunSheet({
  summary,
  filter,
  searchQuery,
  sortKey,
  sortDir,
  groupMode,
  now,
  today,
}: {
  summary: OpsTodayBookingsSummary;
  filter: BookingFilter;
  searchQuery: string;
  sortKey: BookingSortKey;
  sortDir: BookingSortDir;
  groupMode: RunSheetGroupMode;
  now: DateTime;
  /** Today's date key in the restaurant timezone. */
  today: string;
}): OpsRunSheet {
  const allowTableAssignments = summary.date >= today;
  const query = searchQuery.trim().toLowerCase();
  const searched = query
    ? summary.bookings.filter(
        (booking) =>
          booking.customerName.toLowerCase().includes(query) ||
          Boolean(booking.reference?.toLowerCase().includes(query)),
      )
    : summary.bookings;

  const counts = getBookingTabCounts({
    summary: { ...summary, bookings: searched },
    allowTableAssignments,
    hasAssignmentHandlers: true,
    now,
  });

  const matching = searched.filter((booking) =>
    matchesBookingFilter({
      booking,
      filter,
      summary,
      now,
      allowTableAssignments,
      hasAssignmentHandlers: true,
    }),
  );

  const isToday = summary.date === today;
  const direction = sortDir === 'asc' ? 1 : -1;
  const rows = matching
    .map((booking) => buildRunSheetRow(booking, { summary, now, isToday }))
    .sort((a, b) => direction * compareRows(a, b, sortKey));

  let groups: RunSheetGroup[];
  if (groupMode === 'service') {
    groups = SERVICE_GROUPS.map(({ key, label }) =>
      toGroup(
        key,
        label,
        rows.filter((row) => row.serviceKey === key),
        true,
      ),
    );
  } else if (groupMode === 'status') {
    groups = STATUS_GROUPS.map(({ key, label }) =>
      toGroup(
        key,
        label,
        rows.filter((row) => row.category === key),
        false,
      ),
    );
  } else {
    groups = [toGroup('all', null, rows, false)];
  }
  groups = groups.filter((group) => group.rows.length > 0);

  return {
    readableDate: formatDateReadable(summary.date, summary.timezone),
    groups,
    stats: {
      bookings: rows.length,
      covers: coversOf(rows),
      lunchCovers: coversOf(rows.filter((row) => row.serviceKey === 'lunch')),
      dinnerCovers: coversOf(rows.filter((row) => row.serviceKey === 'dinner')),
      allergyFlags: rows.filter((row) => row.allergies.length > 0).length,
      unassigned: rows.filter((row) => row.isUnassigned).length,
    },
    counts,
    criteria: {
      filterLabel: getBookingFilterLabel(filter),
      sortLabel: SORT_LABELS[sortKey],
      sortDirLabel: RUN_SHEET_SORT_DIR_LABELS[sortKey][sortDir].toLowerCase(),
      search: searchQuery.trim(),
    },
    dayBookingCount: summary.bookings.length,
    matchingCount: rows.length,
  };
}

/* ─── columns ─────────────────────────────────────────────────────────────── */

export type RunSheetColumnKey =
  | 'tick'
  | 'time'
  | 'guest'
  | 'party'
  | 'table'
  | 'status'
  | 'diet'
  | 'notes'
  | 'detail';

export type RunSheetColumn = {
  key: RunSheetColumnKey;
  label: string;
  /** Fixed width in millimetres; null takes the remaining width. */
  widthMm: number | null;
  labelHidden?: boolean;
};

/** Column plan per paper orientation. The last visible column takes the remaining width. */
export function planRunSheetColumns(preferences: RunSheetPreferences): RunSheetColumn[] {
  const { columns, paper } = preferences;
  const landscape = paper === 'landscape';
  const detailLabel =
    columns.diet && columns.notes
      ? 'Allergies, dietary and notes'
      : columns.diet
        ? 'Allergies and dietary'
        : 'Notes';

  const plan: (RunSheetColumn | false)[] = [
    columns.tick && { key: 'tick', label: 'Arrival tick box', widthMm: 7, labelHidden: true },
    { key: 'time', label: 'Time', widthMm: 22 },
    { key: 'guest', label: 'Guest', widthMm: landscape ? 46 : 32 },
    { key: 'party', label: 'Party', widthMm: 15 },
    { key: 'table', label: 'Table', widthMm: 30 },
    columns.status && { key: 'status', label: 'Status', widthMm: landscape ? 36 : 31 },
    landscape && columns.diet && { key: 'diet', label: 'Allergies and dietary', widthMm: 52 },
    landscape && columns.notes && { key: 'notes', label: 'Notes', widthMm: null },
    !landscape &&
      (columns.diet || columns.notes) && { key: 'detail', label: detailLabel, widthMm: null },
  ];

  const visible = plan.filter((column): column is RunSheetColumn => Boolean(column));
  const last = visible.at(-1);
  if (last) visible[visible.length - 1] = { ...last, widthMm: null };
  return visible;
}

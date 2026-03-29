import type { BookingDTO } from '@/hooks/useBookings';

export type BookingMeta = {
  startDate: Date;
  isToday: boolean;
  isPastDay: boolean;
  isDone: boolean;
  isSeated: boolean;
  dateLabel: string;
  timeRangeLabel: string;
  customerLabel: string;
  initials: string;
};

export type UrgencyBadge = {
  variant: 'destructive' | 'warning';
  label: string;
};

export type OpsBookingCardViewModel = {
  booking: BookingDTO;
  meta: BookingMeta;
  urgency: UrgencyBadge | null;
  tableLabel: string | null;
  pendingAction?: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show' | null;
  disableActions: boolean;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(
  cacheKey: string,
  options: Intl.DateTimeFormatOptions,
  timeZone: string,
): Intl.DateTimeFormat {
  const key = `${cacheKey}:${timeZone}`;
  const existing = formatterCache.get(key);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    ...options,
  });
  formatterCache.set(key, formatter);
  return formatter;
}

function getDateKey(date: Date, timeZone: string): string {
  const formatter = getFormatter(
    'ops-card-date-key',
    { year: 'numeric', month: '2-digit', day: '2-digit' },
    timeZone,
  );
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function getTableLabel(assignments: BookingDTO['tableAssignments']) {
  if (!assignments || assignments.length === 0) {
    return null;
  }

  const labels: string[] = [];
  for (const group of assignments) {
    const members = group.members ?? [];
    const memberLabels = members.map((member) => member.tableNumber || '—');
    labels.push(memberLabels.join(' + '));
  }
  return labels.join(', ');
}

export function buildBookingMeta(
  booking: BookingDTO,
  timezone: string,
  now: Date,
  timeLabelOverride?: string | null,
): BookingMeta {
  const startDate = new Date(booking.startIso);
  const endDate = booking.endIso ? new Date(booking.endIso) : null;

  const timeFormatter = getFormatter(
    'ops-card-time',
    {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    },
    timezone,
  );
  const dateFormatter = getFormatter(
    'ops-card-date',
    {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    },
    timezone,
  );

  const startTimeStr = timeFormatter.format(startDate);
  const endTimeStr = endDate ? timeFormatter.format(endDate) : null;

  const startKey = getDateKey(startDate, timezone);
  const nowKey = getDateKey(now, timezone);
  const isToday = startKey === nowKey;
  const isPastDay = startKey < nowKey;

  const isDone = ['completed', 'cancelled', 'no_show'].includes(booking.status);
  const isSeated = booking.status === 'checked_in';

  return {
    startDate,
    isToday,
    isPastDay,
    isDone,
    isSeated,
    dateLabel: dateFormatter.format(startDate),
    timeRangeLabel:
      timeLabelOverride ??
      booking.displayTimeRangeLabel ??
      (endTimeStr ? `${startTimeStr} – ${endTimeStr}` : startTimeStr),
    customerLabel: booking.displayCustomerLabel ?? booking.customerName?.trim() ?? 'Walk-in Guest',
    initials:
      booking.displayInitials ??
      (booking.customerName || 'Guest')
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
  };
}

export function getUrgencyBadge(
  meta: BookingMeta,
  now: Date,
  highlightUrgency: boolean,
): UrgencyBadge | null {
  if (!highlightUrgency || meta.isDone || !meta.isToday) return null;
  const diffMinutes = Math.floor((meta.startDate.getTime() - now.getTime()) / 60000);

  if (diffMinutes <= -15) {
    return { variant: 'destructive', label: `${Math.abs(diffMinutes)}m late` };
  }
  if (diffMinutes <= 0) {
    return { variant: 'warning', label: 'Overdue' };
  }
  return null;
}

export function buildOpsBookingCardViewModel(params: {
  booking: BookingDTO;
  timezone: string;
  now: Date;
  pendingAction?: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show' | null;
  actionsDisabled: boolean;
  highlightUrgency?: boolean;
  timeLabelOverride?: string | null;
}): OpsBookingCardViewModel {
  const {
    booking,
    timezone,
    now,
    pendingAction = null,
    actionsDisabled,
    highlightUrgency = true,
    timeLabelOverride,
  } = params;

  const meta = buildBookingMeta(booking, timezone, now, timeLabelOverride);
  const urgency = getUrgencyBadge(meta, now, highlightUrgency);

  return {
    booking,
    meta,
    urgency,
    tableLabel: getTableLabel(booking.tableAssignments),
    pendingAction,
    disableActions: actionsDisabled,
  };
}

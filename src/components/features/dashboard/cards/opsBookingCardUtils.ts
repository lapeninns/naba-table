import { buildOpsBookingCardActionPolicy } from './opsBookingCardActionPolicy';

import type {
  OpsBookingCardActionsViewModel,
  OpsBookingCardPendingAction,
} from './opsBookingCardActionPolicy';
import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsBookingStatus } from '@/types/ops';

export type {
  OpsBookingCardActionPolicyItem,
  OpsBookingCardActionsViewModel,
  OpsBookingCardPendingAction,
  OpsBookingCardPrimaryActionPolicy,
} from './opsBookingCardActionPolicy';

export type NormalizedGuestIdentity = {
  label: string;
  initials: string;
  isWalkInGuest: boolean;
};

export type BookingMeta = {
  startDate: Date;
  isToday: boolean;
  isPastDay: boolean;
  isDone: boolean;
  isSeated: boolean;
  guest: NormalizedGuestIdentity;
  customerLabel: string;
  initials: string;
  dateLabel: string;
  timeRangeLabel: string;
};

export type UrgencyBadge = {
  variant: 'destructive' | 'warning';
  label: string;
};

export type OpsBookingCardHeaderViewModel = {
  bookingId: string;
  status: OpsBookingStatus;
  customerLabel: string;
  initials: string;
  partySizeLabel: string;
  dateLabel: string;
  timeRangeLabel: string;
  isDone: boolean;
  hasNotes: boolean;
  urgency: UrgencyBadge | null;
};

export type OpsBookingCardDetailsViewModel = {
  bookingId: string;
  reference: {
    label: string;
    valueLabel: string;
  };
  table: {
    state: 'assigned' | 'done-empty' | 'unassigned';
    label: string;
  };
  contact: {
    label: string;
    phone: string | null;
    email: string | null;
    emptyLabel: string;
  };
  notes: {
    label: string;
    value: string;
    highlighted: boolean;
  };
};

export type OpsBookingCardViewModel = {
  booking: BookingDTO;
  meta: BookingMeta;
  urgency: UrgencyBadge | null;
  tableLabel: string | null;
  pendingAction: OpsBookingCardPendingAction;
  disableActions: boolean;
  header: OpsBookingCardHeaderViewModel;
  details: OpsBookingCardDetailsViewModel;
  actions: OpsBookingCardActionsViewModel;
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

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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

function getGuestIdentity(booking: BookingDTO): NormalizedGuestIdentity {
  const label =
    normalizeText(booking.displayCustomerLabel) ??
    normalizeText(booking.customerName) ??
    'Walk-in Guest';
  const displayInitials = normalizeText(booking.displayInitials);

  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return {
    label,
    initials: displayInitials ?? (initials || 'WG'),
    isWalkInGuest: label === 'Walk-in Guest',
  };
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
  const guest = getGuestIdentity(booking);
  const timeRangeLabel =
    normalizeText(timeLabelOverride ?? null) ??
    normalizeText(booking.displayTimeRangeLabel) ??
    (endTimeStr ? `${startTimeStr} – ${endTimeStr}` : startTimeStr);

  return {
    startDate,
    isToday,
    isPastDay,
    isDone,
    isSeated,
    guest,
    customerLabel: guest.label,
    initials: guest.initials,
    dateLabel: dateFormatter.format(startDate),
    timeRangeLabel,
  };
}

export function getUrgencyBadge(
  meta: BookingMeta,
  now: Date,
  highlightUrgency: boolean,
): UrgencyBadge | null {
  if (!highlightUrgency || meta.isDone || meta.isSeated || !meta.isToday) return null;
  const diffMinutes = Math.floor((meta.startDate.getTime() - now.getTime()) / 60000);

  if (diffMinutes <= -15) {
    return { variant: 'destructive', label: `${Math.abs(diffMinutes)}m late` };
  }
  if (diffMinutes <= 0) {
    return { variant: 'warning', label: 'Overdue' };
  }
  return null;
}

function getTableDetails(
  tableLabel: string | null,
  isDone: boolean,
): OpsBookingCardDetailsViewModel['table'] {
  if (tableLabel) {
    return {
      state: 'assigned',
      label: `Table ${tableLabel}`,
    };
  }

  if (isDone) {
    return {
      state: 'done-empty',
      label: 'N/A',
    };
  }

  return {
    state: 'unassigned',
    label: 'Unassigned',
  };
}

export function buildOpsBookingCardViewModel(params: {
  booking: BookingDTO;
  timezone: string;
  now: Date;
  pendingAction?: OpsBookingCardPendingAction;
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

  const normalizedBooking: BookingDTO = {
    ...booking,
    customerName: normalizeText(booking.customerName),
    customerEmail: normalizeText(booking.customerEmail),
    customerPhone: normalizeText(booking.customerPhone),
    notes: normalizeText(booking.notes),
    reference: normalizeText(booking.reference),
    displayTimeRangeLabel: normalizeText(booking.displayTimeRangeLabel),
    displayCustomerLabel: normalizeText(booking.displayCustomerLabel),
    displayInitials: normalizeText(booking.displayInitials),
    tableLabel: normalizeText(booking.tableLabel),
  };

  const meta = buildBookingMeta(normalizedBooking, timezone, now, timeLabelOverride);
  const urgency = getUrgencyBadge(meta, now, highlightUrgency);
  const tableLabel =
    normalizedBooking.tableLabel ?? getTableLabel(normalizedBooking.tableAssignments);
  const header: OpsBookingCardHeaderViewModel = {
    bookingId: normalizedBooking.id,
    status: normalizedBooking.status,
    customerLabel: meta.customerLabel,
    initials: meta.initials,
    partySizeLabel: `${normalizedBooking.partySize} Guest${normalizedBooking.partySize === 1 ? '' : 's'}`,
    dateLabel: meta.dateLabel,
    timeRangeLabel: meta.timeRangeLabel,
    isDone: meta.isDone,
    hasNotes: Boolean(normalizedBooking.notes),
    urgency,
  };
  const details: OpsBookingCardDetailsViewModel = {
    bookingId: normalizedBooking.id,
    reference: {
      label: 'Reference',
      valueLabel: `Ref ${normalizedBooking.reference ?? normalizedBooking.id.slice(0, 8)}`,
    },
    table: getTableDetails(tableLabel, meta.isDone),
    contact: {
      label: 'Contact',
      phone: normalizedBooking.customerPhone ?? null,
      email: normalizedBooking.customerEmail ?? null,
      emptyLabel: 'No contact',
    },
    notes: {
      label: 'Notes',
      value: normalizedBooking.notes ?? 'No special requests.',
      highlighted: Boolean(normalizedBooking.notes),
    },
  };
  const actions = buildOpsBookingCardActionPolicy({
    booking: normalizedBooking,
    meta,
    pendingAction,
    actionsDisabled,
  });

  return {
    booking: normalizedBooking,
    meta,
    urgency,
    tableLabel,
    pendingAction,
    disableActions: actionsDisabled,
    header,
    details,
    actions,
  };
}

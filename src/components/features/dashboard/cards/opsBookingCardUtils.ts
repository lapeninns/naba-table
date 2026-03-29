import type { BookingAction } from '@/components/features/booking-state-machine';
import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsBookingStatus } from '@/types/ops';

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
  dateLabel: string;
  timeRangeLabel: string;
};

export type UrgencyBadge = {
  variant: 'destructive' | 'warning';
  label: string;
};

export type BookingTableState = 'assigned' | 'unassigned' | 'not_applicable';

export type OpsBookingCardHeaderModel = {
  bookingId: string;
  status: OpsBookingStatus;
  partySize: number;
  guest: NormalizedGuestIdentity;
  dateLabel: string;
  timeRangeLabel: string;
  hasNotes: boolean;
  urgency: UrgencyBadge | null;
};

export type OpsBookingCardDetailsModel = {
  bookingId: string;
  table: {
    label: string;
    state: BookingTableState;
    tableLabel: string | null;
    valueLabel: string;
  };
  contact: {
    label: string;
    phoneLabel: string | null;
    emailLabel: string | null;
    emptyLabel: string | null;
  };
  reference: {
    label: string;
    valueLabel: string;
  };
  notes: {
    label: string;
    valueLabel: string;
    highlight: boolean;
  };
};

export type OpsBookingCardActionPolicy = {
  details: {
    disabled: boolean;
  };
  menu: {
    edit: {
      disabled: boolean;
    };
    cancel: {
      disabled: boolean;
    };
    noShow: {
      hidden: boolean;
      disabled: boolean;
    };
  };
  primary: {
    hidden: boolean;
    action: Extract<BookingAction, 'check-in' | 'check-out'> | null;
    label: 'Seat Guest' | 'Finish' | null;
    disabled: boolean;
    pending: boolean;
  };
};

export type OpsBookingCardActionsModel = {
  bookingId: string;
  pendingAction: BookingAction | null;
  disableActions: boolean;
  footerCompletionLabel: string | null;
  dialog: {
    customerLabel: string;
    partySize: number;
    dateLabel: string;
    timeRangeLabel: string;
  };
  policy: OpsBookingCardActionPolicy;
};

export type OpsBookingCardViewModel = {
  booking: BookingDTO;
  meta: BookingMeta;
  header: OpsBookingCardHeaderModel;
  details: OpsBookingCardDetailsModel;
  actions: OpsBookingCardActionsModel;
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

function getNormalizedLabel(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function getGuestIdentity(booking: BookingDTO): NormalizedGuestIdentity {
  const label =
    getNormalizedLabel(booking.displayCustomerLabel) ??
    getNormalizedLabel(booking.customerName) ??
    'Walk-in Guest';

  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return {
    label,
    initials: initials || 'WG',
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

  return {
    startDate,
    isToday,
    isPastDay,
    isDone,
    isSeated,
    guest,
    dateLabel: dateFormatter.format(startDate),
    timeRangeLabel:
      timeLabelOverride ??
      booking.displayTimeRangeLabel ??
      (endTimeStr ? `${startTimeStr} – ${endTimeStr}` : startTimeStr),
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

function getTableState(
  booking: BookingDTO,
  meta: BookingMeta,
): OpsBookingCardDetailsModel['table'] {
  const tableLabel = getTableLabel(booking.tableAssignments);
  if (tableLabel) {
    return {
      label: 'Table',
      state: 'assigned',
      tableLabel,
      valueLabel: `Table ${tableLabel}`,
    };
  }

  if (meta.isDone || booking.requiresTableAssignment === false) {
    return {
      label: 'Table',
      state: 'not_applicable',
      tableLabel: null,
      valueLabel: 'N/A',
    };
  }

  return {
    label: 'Table',
    state: 'unassigned',
    tableLabel: null,
    valueLabel: 'Unassigned',
  };
}

function buildDetailsModel(
  booking: BookingDTO,
  meta: BookingMeta,
): OpsBookingCardDetailsModel {
  const reference = getNormalizedLabel(booking.reference) ?? booking.id.slice(0, 8);
  const phoneLabel = getNormalizedLabel(booking.customerPhone);
  const emailLabel = getNormalizedLabel(booking.customerEmail);
  const notes = getNormalizedLabel(booking.notes);

  return {
    bookingId: booking.id,
    table: getTableState(booking, meta),
    contact: {
      label: 'Contact',
      phoneLabel,
      emailLabel,
      emptyLabel: phoneLabel || emailLabel ? null : 'No contact',
    },
    reference: {
      label: 'Booking',
      valueLabel: `Ref ${reference}`,
    },
    notes: {
      label: 'Notes',
      valueLabel: notes ?? 'No special requests.',
      highlight: Boolean(notes),
    },
  };
}

function buildActionPolicy(params: {
  booking: BookingDTO;
  meta: BookingMeta;
  pendingAction: BookingAction | null;
  actionsDisabled: boolean;
}): OpsBookingCardActionsModel {
  const { booking, meta, pendingAction, actionsDisabled } = params;
  const isLifecyclePending = pendingAction === 'check-in' || pendingAction === 'check-out';

  return {
    bookingId: booking.id,
    pendingAction,
    disableActions: actionsDisabled,
    footerCompletionLabel: meta.isDone
      ? booking.status === 'completed'
        ? 'Completed'
        : 'Closed'
      : null,
    dialog: {
      customerLabel: meta.guest.label,
      partySize: booking.partySize,
      dateLabel: meta.dateLabel,
      timeRangeLabel: meta.timeRangeLabel,
    },
    policy: {
      details: {
        disabled: actionsDisabled,
      },
      menu: {
        edit: {
          disabled: actionsDisabled || meta.isPastDay,
        },
        cancel: {
          disabled: actionsDisabled || meta.isPastDay,
        },
        noShow: {
          hidden: false,
          disabled: actionsDisabled || !meta.isToday || meta.isSeated || meta.isDone,
        },
      },
      primary: meta.isDone
        ? {
            hidden: true,
            action: null,
            label: null,
            disabled: true,
            pending: false,
          }
        : meta.isSeated
          ? {
              hidden: false,
              action: 'check-out',
              label: 'Finish',
              disabled: actionsDisabled || !meta.isToday || isLifecyclePending,
              pending: isLifecyclePending,
            }
          : {
              hidden: false,
              action: 'check-in',
              label: 'Seat Guest',
              disabled: actionsDisabled || !meta.isToday || isLifecyclePending,
              pending: isLifecyclePending,
            },
    },
  };
}

export function buildOpsBookingCardViewModel(params: {
  booking: BookingDTO;
  timezone: string;
  now: Date;
  pendingAction?: BookingAction | null;
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
  const header: OpsBookingCardHeaderModel = {
    bookingId: booking.id,
    status: booking.status as OpsBookingStatus,
    partySize: booking.partySize,
    guest: meta.guest,
    dateLabel: meta.dateLabel,
    timeRangeLabel: meta.timeRangeLabel,
    hasNotes: Boolean(getNormalizedLabel(booking.notes)),
    urgency,
  };

  return {
    booking,
    meta,
    header,
    details: buildDetailsModel(booking, meta),
    actions: buildActionPolicy({
      booking,
      meta,
      pendingAction,
      actionsDisabled,
    }),
  };
}

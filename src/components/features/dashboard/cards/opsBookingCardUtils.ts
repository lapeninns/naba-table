import type { BookingAction } from '@/components/features/booking-state-machine';
import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsBookingStatus } from '@/types/ops';

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

export type OpsBookingCardPendingAction =
  | 'check-in'
  | 'check-out'
  | 'no-show'
  | 'undo-no-show'
  | null;

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
  referenceLabel: string;
  table: {
    state: 'assigned' | 'done-empty' | 'unassigned';
    label: string;
  };
  contact: {
    phone: string | null;
    email: string | null;
    emptyLabel: string;
  };
  notes: {
    value: string;
    highlighted: boolean;
  };
};

export type OpsBookingCardActionPolicyItem = {
  id: 'details' | 'edit' | 'no-show' | 'cancel';
  label: string;
  disabled: boolean;
  valid: boolean;
  variant?: 'default' | 'destructive';
};

export type OpsBookingCardPrimaryActionPolicy =
  | {
      kind: 'button';
      id: 'check-in' | 'check-out';
      label: string;
      disabled: boolean;
      valid: boolean;
      pending: boolean;
    }
  | {
      kind: 'status';
      label: string;
    };

export type OpsBookingCardActionsViewModel = {
  bookingId: string;
  pendingAction: OpsBookingCardPendingAction;
  details: OpsBookingCardActionPolicyItem;
  menuItems: [
    OpsBookingCardActionPolicyItem,
    OpsBookingCardActionPolicyItem,
    OpsBookingCardActionPolicyItem,
  ];
  primary: OpsBookingCardPrimaryActionPolicy;
  noShowConfirmation: {
    title: string;
    description: {
      customerLabel: string;
      partySize: number;
      dateLabel: string;
      timeRangeLabel: string;
    };
    confirmLabel: string;
    cancelLabel: string;
    disabled: boolean;
    pending: boolean;
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

function getInitialsFromLabel(label: string): string {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return initials || 'G';
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
  const customerLabel =
    normalizeText(booking.displayCustomerLabel) ??
    normalizeText(booking.customerName) ??
    'Walk-in Guest';
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
    dateLabel: dateFormatter.format(startDate),
    timeRangeLabel,
    customerLabel,
    initials: normalizeText(booking.displayInitials) ?? getInitialsFromLabel(customerLabel),
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

function getTableDetails(tableLabel: string | null, isDone: boolean): OpsBookingCardDetailsViewModel['table'] {
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

function buildOpsBookingCardActionPolicy(params: {
  booking: BookingDTO;
  meta: BookingMeta;
  pendingAction: OpsBookingCardPendingAction;
  actionsDisabled: boolean;
}): OpsBookingCardActionsViewModel {
  const { booking, meta, pendingAction, actionsDisabled } = params;
  const isPendingMutation = pendingAction !== null;
  const isMutatingDisabled = actionsDisabled || isPendingMutation;
  const detailsDisabled = actionsDisabled && !isPendingMutation;

  const editValid = !meta.isDone && !meta.isPastDay;
  const noShowValid = !meta.isDone && meta.isToday && !meta.isSeated;
  const cancelValid = !meta.isDone && !meta.isPastDay;

  const details: OpsBookingCardActionPolicyItem = {
    id: 'details',
    label: 'Details',
    disabled: detailsDisabled,
    valid: true,
    variant: 'default',
  };

  const menuItems: OpsBookingCardActionsViewModel['menuItems'] = [
    {
      id: 'edit',
      label: 'Edit Booking',
      disabled: !editValid || isMutatingDisabled,
      valid: editValid,
      variant: 'default',
    },
    {
      id: 'no-show',
      label: 'Mark No Show',
      disabled: !noShowValid || isMutatingDisabled,
      valid: noShowValid,
      variant: 'destructive',
    },
    {
      id: 'cancel',
      label: 'Cancel Booking',
      disabled: !cancelValid || isMutatingDisabled,
      valid: cancelValid,
      variant: 'destructive',
    },
  ];

  const primary: OpsBookingCardPrimaryActionPolicy = meta.isDone
    ? {
        kind: 'status',
        label: booking.status === 'completed' ? 'Completed' : 'Closed',
      }
    : {
        kind: 'button',
        id: meta.isSeated ? 'check-out' : 'check-in',
        label: meta.isSeated ? 'Finish' : 'Seat Guest',
        disabled: !meta.isToday || isMutatingDisabled,
        valid: meta.isToday,
        pending: pendingAction === 'check-in' || pendingAction === 'check-out',
      };

  return {
    bookingId: booking.id,
    pendingAction,
    details,
    menuItems,
    primary,
    noShowConfirmation: {
      title: 'Mark as no-show?',
      description: {
        customerLabel: meta.customerLabel,
        partySize: booking.partySize,
        dateLabel: meta.dateLabel,
        timeRangeLabel: meta.timeRangeLabel,
      },
      confirmLabel: 'Confirm no-show',
      cancelLabel: 'Keep booking',
      disabled: menuItems[1].disabled,
      pending: pendingAction === 'no-show',
    },
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
  const tableLabel = getTableLabel(booking.tableAssignments);
  const header: OpsBookingCardHeaderViewModel = {
    bookingId: booking.id,
    status: booking.status,
    customerLabel: meta.customerLabel,
    initials: meta.initials,
    partySizeLabel: `${booking.partySize} Guest${booking.partySize === 1 ? '' : 's'}`,
    dateLabel: meta.dateLabel,
    timeRangeLabel: meta.timeRangeLabel,
    isDone: meta.isDone,
    hasNotes: Boolean(booking.notes),
    urgency,
  };
  const details: OpsBookingCardDetailsViewModel = {
    bookingId: booking.id,
    referenceLabel: `Ref ${booking.reference || booking.id.slice(0, 8)}`,
    table: getTableDetails(tableLabel, meta.isDone),
    contact: {
      phone: booking.customerPhone ?? null,
      email: booking.customerEmail ?? null,
      emptyLabel: 'No contact',
    },
    notes: {
      value: booking.notes || 'No special requests.',
      highlighted: Boolean(booking.notes),
    },
  };
  const actions = buildOpsBookingCardActionPolicy({
    booking,
    meta,
    pendingAction,
    actionsDisabled,
  });

  return {
    booking: normalizedBooking,
    meta,
    urgency,
    tableLabel: normalizedBooking.tableLabel ?? getTableLabel(normalizedBooking.tableAssignments),
    pendingAction,
    disableActions: actionsDisabled,
    header,
    details,
    actions,
  };
}

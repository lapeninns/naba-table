import type { BookingActionType } from './types';
import type { FlattenedTable } from './utils';
import type { OpsTodayBooking } from '@/types/ops';

const HEADER_TONES: Record<string, string> = {
  checked_in: 'border-l-4 border-primary/30 bg-primary/10',
  confirmed: 'border-l-4 border-primary/30 bg-primary/10',
  late: 'border-l-4 border-destructive/20 bg-destructive/10',
};

export function getBookingDialogHeaderStatus({
  minutesRemaining,
  status,
}: {
  minutesRemaining: number | null;
  status: string;
}): string {
  if (status === 'confirmed' && minutesRemaining !== null && minutesRemaining < 0) {
    return 'late';
  }
  return status;
}

export function getBookingDialogHeaderTone(status: string): string {
  return HEADER_TONES[status] ?? 'border-l-4 border-border bg-background';
}

export function buildBookingDialogTitleText(booking: OpsTodayBooking | null): string {
  return booking?.customerName ? `Booking for ${booking.customerName}` : 'Booking details';
}

export function buildBookingDialogDescriptionText({
  booking,
  formattedDate,
  formattedStartTime,
}: {
  booking: OpsTodayBooking | null;
  formattedDate: string;
  formattedStartTime: string;
}): string {
  return booking
    ? `${formattedDate} · ${formattedStartTime} · ${booking.partySize} covers`
    : 'Booking overview and table assignment';
}

export function buildBookingSummaryText({
  assignedTableRows,
  booking,
  formattedDate,
  formattedEndTime,
  formattedStartTime,
  statusLabel,
}: {
  assignedTableRows: FlattenedTable[];
  booking: OpsTodayBooking;
  formattedDate: string;
  formattedEndTime: string;
  formattedStartTime: string;
  statusLabel: string;
}): string {
  const tableLabel = assignedTableRows.length
    ? assignedTableRows.map((member) => member.tableNumber).join(', ')
    : 'Unassigned';

  return [
    `Booking: ${booking.customerName}`,
    `Covers: ${booking.partySize}`,
    `Time: ${formattedDate} ${formattedStartTime}${booking.endTime ? ` - ${formattedEndTime}` : ''}`,
    `Status: ${statusLabel}`,
    `Reference: ${booking.reference ?? booking.id}`,
    `Tables: ${tableLabel}`,
    booking.customerPhone ? `Phone: ${booking.customerPhone}` : null,
    booking.customerEmail ? `Email: ${booking.customerEmail}` : null,
    booking.notes ? `Notes: ${booking.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export type BookingDialogPrimaryActionId = 'assign-table' | BookingActionType;

export type BookingDialogPrimaryActionDecision = {
  id: BookingDialogPrimaryActionId;
  label: string;
  tone: string;
} | null;

export type BookingDialogActionState = {
  canCancel: boolean;
  canCheckOut: boolean;
  canUndoNoShow: boolean;
  needsAssignment: boolean;
  primaryAction: BookingDialogPrimaryActionDecision;
  shouldShowNoShow: boolean;
};

export function resolveBookingDialogActionState({
  allowTableAssignments,
  assignedTableCount,
  canCheckInBooking,
  hasBooking,
  hasCancelHandler,
  hasCheckInHandler,
  hasCheckOutHandler,
  hasMarkNoShowHandler,
  hasUndoNoShowHandler,
  isToday,
  requiresTableAssignment,
  status,
}: {
  allowTableAssignments: boolean;
  assignedTableCount: number;
  canCheckInBooking: boolean;
  hasBooking: boolean;
  hasCancelHandler: boolean;
  hasCheckInHandler: boolean;
  hasCheckOutHandler: boolean;
  hasMarkNoShowHandler: boolean;
  hasUndoNoShowHandler: boolean;
  isToday: boolean;
  requiresTableAssignment: boolean;
  status: string;
}): BookingDialogActionState {
  const shouldShowNoShow = hasBooking && isToday && hasMarkNoShowHandler;
  const canUndoNoShow = status === 'no_show';
  const canCheckOut = status === 'checked_in';
  const needsAssignment =
    hasBooking && requiresTableAssignment && allowTableAssignments && assignedTableCount === 0;
  const canCancel =
    hasBooking &&
    hasCancelHandler &&
    !['cancelled', 'completed', 'no_show', 'checked_in'].includes(status);

  return {
    canCancel,
    canCheckOut,
    canUndoNoShow,
    needsAssignment,
    primaryAction: resolveBookingDialogPrimaryAction({
      canCheckInBooking,
      canCheckOut,
      canUndoNoShow,
      hasBooking,
      hasCheckInHandler,
      hasCheckOutHandler,
      hasUndoNoShowHandler,
      isToday,
      needsAssignment,
    }),
    shouldShowNoShow,
  };
}

function resolveBookingDialogPrimaryAction({
  canCheckInBooking,
  canCheckOut,
  canUndoNoShow,
  hasBooking,
  hasCheckInHandler,
  hasCheckOutHandler,
  hasUndoNoShowHandler,
  isToday,
  needsAssignment,
}: {
  canCheckInBooking: boolean;
  canCheckOut: boolean;
  canUndoNoShow: boolean;
  hasBooking: boolean;
  hasCheckInHandler: boolean;
  hasCheckOutHandler: boolean;
  hasUndoNoShowHandler: boolean;
  isToday: boolean;
  needsAssignment: boolean;
}): BookingDialogPrimaryActionDecision {
  if (!hasBooking) {
    return null;
  }

  if (needsAssignment) {
    return {
      id: 'assign-table',
      label: 'Assign table',
      tone: 'bg-primary hover:bg-primary/90',
    };
  }

  if (canCheckOut && hasCheckOutHandler) {
    return {
      id: 'check-out',
      label: 'Complete visit',
      tone: 'bg-primary/10 hover:bg-primary/10',
    };
  }

  if (canUndoNoShow && hasUndoNoShowHandler) {
    return {
      id: 'undo-no-show',
      label: 'Undo no-show',
      tone: 'bg-primary hover:bg-primary/90',
    };
  }

  if (isToday && canCheckInBooking && hasCheckInHandler) {
    return {
      id: 'check-in',
      label: 'Mark arrived',
      tone: 'bg-primary/10 hover:bg-primary/10',
    };
  }

  return null;
}

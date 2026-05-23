import type { BookingDTO } from '@/hooks/useBookings';

export type OpsBookingCardPendingAction =
  | 'check-in'
  | 'check-out'
  | 'no-show'
  | 'undo-no-show'
  | null;

export type OpsBookingCardActionPolicyMeta = {
  isToday: boolean;
  isPastDay: boolean;
  isDone: boolean;
  isSeated: boolean;
  customerLabel: string;
  dateLabel: string;
  timeRangeLabel: string;
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

export function buildOpsBookingCardActionPolicy(params: {
  booking: BookingDTO;
  meta: OpsBookingCardActionPolicyMeta;
  pendingAction: OpsBookingCardPendingAction;
  actionsDisabled: boolean;
}): OpsBookingCardActionsViewModel {
  const { booking, meta, pendingAction, actionsDisabled } = params;
  const isPendingMutation = pendingAction !== null;
  const isMutatingDisabled = actionsDisabled || isPendingMutation;
  const detailsDisabled = isMutatingDisabled;

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
        label:
          booking.status === 'completed'
            ? 'Completed'
            : booking.status === 'cancelled'
              ? 'Cancelled'
              : booking.status === 'no_show'
                ? 'No show'
                : 'Closed',
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

'use client';

import { useMemo, useState, type ReactElement, type ReactNode } from 'react';

import { useBookingOfflineQueue } from '@/contexts/booking-offline-queue';
import { useOptionalBookingState } from '@/contexts/booking-state-machine';

import {
  BOOKING_ACTION_DISABLED_REASON,
  isBookingAction,
  isBookingActionPending,
  isBookingLifecycleRestrictedAction,
  isPrimaryBookingActionDisabled,
  isSecondaryBookingActionDisabled,
  normalizeBookingActionReason,
  resolveBookingActionDisabledReason,
  resolvePrimaryBookingActionConfig,
  resolveSecondaryBookingActionConfig,
  type BookingAction,
  type BookingActionButtonConfig,
  type BookingActionSubject,
} from './bookingActionButtonDomain';
import { BookingActionControlButton } from './BookingActionControlButton';
import { BookingActionReasonDialog } from './BookingActionReasonDialog';

import type { TriggerProps } from './ConfirmationDialog';

export type { BookingAction, BookingActionSubject } from './bookingActionButtonDomain';

type BookingActionButtonProps = {
  booking: BookingActionSubject;
  pendingAction: BookingAction | null;
  onCheckIn: (options?: { performedAt?: string | null }) => Promise<void>;
  onCheckOut: (options?: { performedAt?: string | null }) => Promise<void>;
  onMarkNoShow: (options?: {
    performedAt?: string | null;
    reason?: string | null;
  }) => Promise<void>;
  onUndoNoShow: (reason?: string | null) => Promise<void>;
  showConfirmation?: boolean;
  className?: string;
  lifecycleAvailability?: {
    isToday: boolean;
    reason?: string;
  };
};

export function BookingActionButton({
  booking,
  pendingAction,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onUndoNoShow,
  showConfirmation = true,
  className,
  lifecycleAvailability,
}: BookingActionButtonProps) {
  const bookingState = useOptionalBookingState(booking.id);
  const effectiveStatus = bookingState?.effectiveStatus ?? booking.status;
  const offlineQueue = useBookingOfflineQueue();
  const queuedAction = offlineQueue?.getPendingAction(booking.id) ?? null;
  const queuedActionType = isBookingAction(queuedAction?.action) ? queuedAction.action : null;
  const isQueued = Boolean(queuedActionType);

  const [noShowReason, setNoShowReason] = useState('');
  const [undoReason, setUndoReason] = useState('');

  const availability = lifecycleAvailability ?? { isToday: true };
  const isLifecycleRestricted = !availability.isToday;
  const availabilityTooltip =
    availability.reason ?? 'Lifecycle actions are only available on the reservation date.';

  const primaryConfig = useMemo(
    () => resolvePrimaryBookingActionConfig(effectiveStatus),
    [effectiveStatus],
  );

  const secondaryConfig = useMemo(
    () => resolveSecondaryBookingActionConfig(effectiveStatus),
    [effectiveStatus],
  );

  const isPrimaryPending = isBookingActionPending({
    action: primaryConfig.action,
    pendingAction,
    queuedActionType,
  });
  const isSecondaryPending = secondaryConfig
    ? isBookingActionPending({
        action: secondaryConfig.action,
        pendingAction,
        queuedActionType,
      })
    : false;

  const basePrimaryDisabled = isPrimaryBookingActionDisabled({
    isQueued,
    pendingAction,
    primaryConfig,
  });

  const baseSecondaryDisabled = isSecondaryBookingActionDisabled({
    isQueued,
    pendingAction,
    secondaryConfig,
  });

  const noShowRestricted = isLifecycleRestricted && secondaryConfig?.action === 'no-show';
  const undoNoShowRestricted = isLifecycleRestricted && secondaryConfig?.action === 'undo-no-show';

  const primaryDisabled = basePrimaryDisabled;
  const secondaryDisabled = baseSecondaryDisabled;

  const renderButton = (
    { action, label, variant, tooltip }: BookingActionButtonConfig,
    disabled: boolean,
    onClick: () => void,
    pending: boolean,
  ): ReactElement => {
    const reason = resolveBookingActionDisabledReason({
      action,
      disabled,
      isQueued,
      queuedActionType,
      tooltip,
    });
    return (
      <BookingActionControlButton
        className={className}
        config={{ action, label, variant, tooltip }}
        disabled={disabled}
        disabledReason={reason}
        onPress={onClick}
        pending={pending}
      />
    );
  };

  const handlePrimary = async () => {
    if (primaryConfig.action === 'check-in') {
      await onCheckIn();
    } else if (primaryConfig.action === 'check-out') {
      await onCheckOut();
    }
  };

  const primaryTooltip = primaryConfig.tooltip;

  const primaryElement = (() => {
    if (
      isBookingLifecycleRestrictedAction({ action: primaryConfig.action, isLifecycleRestricted })
    ) {
      return renderButton(
        { ...primaryConfig, tooltip: availabilityTooltip },
        true,
        () => {},
        isPrimaryPending,
      );
    }

    if (primaryConfig.action !== 'unavailable') {
      return renderButton(
        { ...primaryConfig, tooltip: primaryTooltip },
        primaryDisabled,
        () => void handlePrimary(),
        isPrimaryPending,
      );
    }

    return renderButton(primaryConfig, true, () => {}, false);
  })();

  let secondaryElement: ReactNode = null;
  if (secondaryConfig) {
    if (
      (noShowRestricted && secondaryConfig.action === 'no-show') ||
      (undoNoShowRestricted && secondaryConfig.action === 'undo-no-show')
    ) {
      secondaryElement = renderButton(
        { ...secondaryConfig, tooltip: availabilityTooltip },
        true,
        () => {},
        isSecondaryPending,
      );
    } else if (!showConfirmation) {
      const handler =
        secondaryConfig.action === 'no-show'
          ? () => {
              void onMarkNoShow();
            }
          : () => {
              void onUndoNoShow();
            };
      const tooltip =
        secondaryConfig.action === 'no-show' && noShowRestricted
          ? availabilityTooltip
          : BOOKING_ACTION_DISABLED_REASON[secondaryConfig.action as BookingAction];
      secondaryElement = renderButton(
        { ...secondaryConfig, tooltip },
        secondaryDisabled,
        handler,
        isSecondaryPending,
      );
    } else if (secondaryDisabled) {
      const tooltip =
        secondaryConfig.action === 'no-show' && noShowRestricted
          ? availabilityTooltip
          : BOOKING_ACTION_DISABLED_REASON[secondaryConfig.action as BookingAction];
      secondaryElement = renderButton(
        { ...secondaryConfig, tooltip },
        true,
        () => {},
        isSecondaryPending,
      );
    } else if (secondaryConfig.action === 'no-show') {
      const trigger = renderButton(
        {
          ...secondaryConfig,
          tooltip: noShowRestricted
            ? availabilityTooltip
            : BOOKING_ACTION_DISABLED_REASON['no-show'],
        },
        false,
        () => {},
        isSecondaryPending,
      ) as ReactElement<TriggerProps>;

      secondaryElement = (
        <BookingActionReasonDialog
          trigger={trigger}
          title="Mark as no show?"
          description="This guest will be marked as not having arrived."
          confirmLabel="Mark no show"
          pending={isSecondaryPending}
          onConfirm={async () => {
            await onMarkNoShow({
              reason: normalizeBookingActionReason(noShowReason),
            });
            setNoShowReason('');
          }}
          onAfterClose={() => {
            setNoShowReason('');
          }}
          reason={noShowReason}
          onReasonChange={setNoShowReason}
        />
      );
    } else if (secondaryConfig.action === 'undo-no-show') {
      const trigger = renderButton(
        { ...secondaryConfig, tooltip: BOOKING_ACTION_DISABLED_REASON['undo-no-show'] },
        false,
        () => {},
        isSecondaryPending,
      ) as ReactElement<TriggerProps>;

      secondaryElement = (
        <BookingActionReasonDialog
          trigger={trigger}
          title="Undo no show?"
          description="This will restore the booking to confirmed status."
          confirmLabel="Restore booking"
          pending={isSecondaryPending}
          onConfirm={async () => {
            await onUndoNoShow(normalizeBookingActionReason(undoReason));
            setUndoReason('');
          }}
          onAfterClose={() => {
            setUndoReason('');
          }}
          reason={undoReason}
          onReasonChange={setUndoReason}
        />
      );
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {primaryElement}
      {secondaryElement}
    </div>
  );
}

"use client";

import { useMemo, useState, type ReactElement, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBookingOfflineQueue } from "@/contexts/booking-offline-queue";
import { useOptionalBookingState } from "@/contexts/booking-state-machine";
import { cn } from "@/lib/utils";

import { ConfirmationDialog, type TriggerProps } from "./ConfirmationDialog";


import type { OpsBookingStatus } from "@/types/ops";

export type BookingAction = "check-in" | "check-out" | "no-show" | "undo-no-show";

export type BookingActionSubject = {
  id: string;
  status: OpsBookingStatus;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
};

type BookingActionButtonProps = {
  booking: BookingActionSubject;
  pendingAction: BookingAction | null;
  onCheckIn: (options?: { performedAt?: string | null }) => Promise<void>;
  onCheckOut: (options?: { performedAt?: string | null }) => Promise<void>;
  onMarkNoShow: (options?: { performedAt?: string | null; reason?: string | null }) => Promise<void>;
  onUndoNoShow: (reason?: string | null) => Promise<void>;
  showConfirmation?: boolean;
  className?: string;
  lifecycleAvailability?: {
    isToday: boolean;
    reason?: string;
  };
};

type ButtonConfig = {
  action: BookingAction | "completed" | "unavailable";
  label: string;
  variant: "default" | "secondary" | "destructive";
  tooltip?: string | null;
};

const DISABLED_REASON: Record<BookingAction, string> = {
  "check-in": "Guest must be in confirmed status to check in.",
  "check-out": "Guest must be checked in before you can check out.",
  "no-show": "Only confirmed bookings can be marked as no-show.",
  "undo-no-show": "Undo is available only for no-show bookings.",
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
  const queuedActionType = queuedAction?.action ?? null;
  const isQueued = Boolean(queuedActionType);

  const [noShowReason, setNoShowReason] = useState("");
  const [undoReason, setUndoReason] = useState("");

  const availability = lifecycleAvailability ?? { isToday: true };
  const isLifecycleRestricted = !availability.isToday;
  const availabilityTooltip = availability.reason ?? "Check-in and no-show actions are only available on the reservation date.";

  const primaryConfig: ButtonConfig = useMemo(() => {
    switch (effectiveStatus) {
      case "confirmed":
      case "PRIORITY_WAITLIST":
        return { action: "check-in", label: "Seat Guest", variant: "default" };
      case "checked_in":
        return { action: "check-out", label: "Check out", variant: "default" };
      case "completed":
        return { action: "completed", label: "Checked out", variant: "default", tooltip: "Guest already checked out." };
      case "cancelled":
        return { action: "unavailable", label: "Cancelled", variant: "secondary", tooltip: "Cancelled bookings cannot change status." };
      case "no_show":
        return { action: "unavailable", label: "No show", variant: "secondary", tooltip: "Use undo no show to restore booking." };
      default:
        return { action: "unavailable", label: "Unavailable", variant: "secondary" };
    }
  }, [effectiveStatus]);

  const secondaryConfig: ButtonConfig | null = useMemo(() => {
    if (effectiveStatus === "confirmed" || effectiveStatus === "PRIORITY_WAITLIST") {
      return { action: "no-show", label: "Mark no show", variant: "destructive" };
    }
    if (effectiveStatus === "no_show") {
      return { action: "undo-no-show", label: "Undo no show", variant: "secondary" };
    }
    return null;
  }, [effectiveStatus]);

  const isPrimaryPending = pendingAction === primaryConfig.action || queuedActionType === primaryConfig.action;
  const isSecondaryPending = secondaryConfig
    ? pendingAction === secondaryConfig.action || queuedActionType === secondaryConfig.action
    : false;

  const basePrimaryDisabled = (() => {
    if (isQueued) {
      return true;
    }
    if (primaryConfig.action === "completed" || primaryConfig.action === "unavailable") {
      return true;
    }
    if (pendingAction && pendingAction !== primaryConfig.action) {
      return true;
    }
    return false;
  })();

  const baseSecondaryDisabled = (() => {
    if (!secondaryConfig) return true;
    if (isQueued) {
      return true;
    }
    if (pendingAction && pendingAction !== secondaryConfig.action) {
      return true;
    }
    return false;
  })();

  const checkInRestricted = isLifecycleRestricted && primaryConfig.action === "check-in";
  const noShowRestricted = isLifecycleRestricted && secondaryConfig?.action === "no-show";

  const primaryDisabled = basePrimaryDisabled;
  const secondaryDisabled = baseSecondaryDisabled;

  const renderButton = (
    { label, variant, tooltip }: ButtonConfig,
    disabled: boolean,
    onClick: () => void,
    pending: boolean,
    ariaLabel: string,
  ): ReactElement => {
    let reason: string | null = null;
    if (disabled) {
      if (tooltip) {
        reason = tooltip;
      } else {
        const actionKey = ariaLabel as BookingAction;
        if (Object.prototype.hasOwnProperty.call(DISABLED_REASON, actionKey)) {
          reason = DISABLED_REASON[actionKey];
        }
      }
      if (isQueued) {
        reason = queuedActionType === ariaLabel
          ? 'Action queued while offline. It will sync automatically.'
          : reason ?? 'Another action for this booking is queued while offline.';
      }
    }
    const button = (
      <Button
        variant={variant}
        size="sm"
        className={cn("h-11 min-w-[140px] touch-manipulation font-semibold", className)}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          onClick();
        }}
      >
        {pending ? `${label}…` : label}
      </Button>
    );

    if (!reason) {
      return button;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
          {reason}
        </TooltipContent>
      </Tooltip>
    );
  };

  const handlePrimary = async () => {
    if (primaryConfig.action === "check-in") {
      await onCheckIn();
    } else if (primaryConfig.action === "check-out") {
      await onCheckOut();
    }
  };

  const primaryTooltip = primaryConfig.tooltip;

  const primaryElement = (() => {
    if (checkInRestricted && primaryConfig.action === "check-in") {
      return null;
    }

    if (primaryConfig.action !== "unavailable") {
      return renderButton(
        { ...primaryConfig, tooltip: primaryTooltip },
        primaryDisabled,
        () => void handlePrimary(),
        isPrimaryPending,
        primaryConfig.action,
      );
    }

    return renderButton(primaryConfig, true, () => {}, false, "unavailable");
  })();

  let secondaryElement: ReactNode = null;
  if (secondaryConfig) {
    if (noShowRestricted && secondaryConfig.action === "no-show") {
      secondaryElement = null;
    } else if (!showConfirmation) {
      const handler = secondaryConfig.action === "no-show"
        ? () => { void onMarkNoShow(); }
        : () => { void onUndoNoShow(); };
      const tooltip = secondaryConfig.action === "no-show" && noShowRestricted
        ? availabilityTooltip
        : DISABLED_REASON[secondaryConfig.action as BookingAction];
      secondaryElement = renderButton(
        { ...secondaryConfig, tooltip },
        secondaryDisabled,
        handler,
        isSecondaryPending,
        secondaryConfig.action,
      );
    } else if (secondaryDisabled) {
      const tooltip = secondaryConfig.action === "no-show" && noShowRestricted
        ? availabilityTooltip
        : DISABLED_REASON[secondaryConfig.action as BookingAction];
      secondaryElement = renderButton(
        { ...secondaryConfig, tooltip },
        true,
        () => {},
        isSecondaryPending,
        secondaryConfig.action,
      );
    } else if (secondaryConfig.action === "no-show") {
      const trigger = renderButton(
        {
          ...secondaryConfig,
          tooltip: noShowRestricted ? availabilityTooltip : DISABLED_REASON["no-show"],
        },
        false,
        () => {},
        isSecondaryPending,
        secondaryConfig.action,
      ) as ReactElement<TriggerProps>;

      secondaryElement = (
        <ConfirmationDialog
          trigger={trigger}
          title="Mark as no show?"
          description="This guest will be marked as not having arrived."
          confirmLabel="Mark no show"
          pending={isSecondaryPending}
          onConfirm={async () => {
            await onMarkNoShow({
              reason: noShowReason.trim().length > 0 ? noShowReason.trim() : null,
            });
            setNoShowReason("");
          }}
          onAfterClose={() => {
            setNoShowReason("");
          }}
        >
          <Textarea
            placeholder="Reason (optional)"
            value={noShowReason}
            onChange={(event) => setNoShowReason(event.target.value)}
            className="min-h-[80px] resize-none"
          />
        </ConfirmationDialog>
      );
    } else if (secondaryConfig.action === "undo-no-show") {
      const trigger = renderButton(
        { ...secondaryConfig, tooltip: DISABLED_REASON["undo-no-show"] },
        false,
        () => {},
        isSecondaryPending,
        secondaryConfig.action,
      ) as ReactElement<TriggerProps>;

      secondaryElement = (
        <ConfirmationDialog
          trigger={trigger}
          title="Undo no show?"
          description="This will restore the booking to confirmed status."
          confirmLabel="Restore booking"
          pending={isSecondaryPending}
          onConfirm={async () => {
            await onUndoNoShow(undoReason.trim().length > 0 ? undoReason.trim() : null);
            setUndoReason("");
          }}
          onAfterClose={() => {
            setUndoReason("");
          }}
        >
          <Textarea
            placeholder="Reason (optional)"
            value={undoReason}
            onChange={(event) => setUndoReason(event.target.value)}
            className="min-h-[80px] resize-none"
          />
        </ConfirmationDialog>
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

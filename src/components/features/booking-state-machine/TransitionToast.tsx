"use client";

import { RotateCcw } from "lucide-react";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

import type { OpsBookingStatus } from "@/types/ops";

type TransitionToastAction = "check-in" | "check-out" | "no-show" | "undo-no-show" | "status-update";

export type TransitionToastSuccessOptions = {
  action: TransitionToastAction;
  bookingLabel?: string;
  performedAtLabel?: string;
};

export type TransitionToastErrorOptions = {
  action: TransitionToastAction;
  errorMessage?: string;
  bookingLabel?: string;
};

export type TransitionToastExternalUpdateOptions = {
  bookingLabel?: string;
  fromStatus?: OpsBookingStatus | null;
  toStatus: OpsBookingStatus | null;
  onUndo?: () => void;
  undoLabel?: string;
};

export type TransitionToastQueuedOptions = {
  action: TransitionToastAction;
  bookingLabel?: string;
};

function formatActionLabel(action: TransitionToastAction): string {
  switch (action) {
    case "check-in":
      return "checked in";
    case "check-out":
      return "checked out";
    case "no-show":
      return "marked no-show";
    case "undo-no-show":
      return "restored to confirmed";
    default:
      return "updated";
  }
}

export function useTransitionToast() {
  const { toast, dismiss } = useToast();

  const showSuccess = useCallback(
    ({ action, bookingLabel, performedAtLabel }: TransitionToastSuccessOptions) => {
      const label = bookingLabel ? `Booking ${bookingLabel}` : "Booking";
      const actionLabel = formatActionLabel(action);
      let description: string | undefined;

      if (action === "no-show") {
        const base = performedAtLabel ? `Effective ${performedAtLabel}.` : null;
        const hint = "Any assigned tables have been released.";
        description = [base, hint].filter(Boolean).join(" ");
      } else if (performedAtLabel) {
        description = `Effective ${performedAtLabel}.`;
      }

      toast({
        title: `${label} ${actionLabel}`,
        description,
        className: "border-emerald-200 bg-emerald-50 text-emerald-900",
      });
    },
    [toast],
  );

  const showError = useCallback(
    ({ action, errorMessage, bookingLabel }: TransitionToastErrorOptions) => {
      const label = bookingLabel ? `Booking ${bookingLabel}` : "Booking";
      const actionLabel = formatActionLabel(action);
      const message = errorMessage ?? "Something went wrong. Please try again.";
      toast({
        title: `${label} not ${actionLabel}`,
        description: message,
        variant: "destructive",
      });
    },
    [toast],
  );

  const showExternalUpdate = useCallback(
    ({ bookingLabel, fromStatus, toStatus, onUndo, undoLabel }: TransitionToastExternalUpdateOptions) => {
      const label = bookingLabel ? `Booking ${bookingLabel}` : "A booking";
      const fromText = fromStatus ? fromStatus.replaceAll("_", " ") : "previous";
      const toText = toStatus ? toStatus.replaceAll("_", " ") : "new";
      toast({
        title: `${label} updated externally`,
        description: (
          <span className="capitalize">
            Status changed from {fromText} to {toText}.
          </span>
        ),
        action: onUndo ? (
          <ToastAction asChild altText="Undo change">
            <Button variant="outline" size="sm" onClick={onUndo} className="inline-flex items-center gap-1">
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{undoLabel ?? "Undo"}</span>
            </Button>
          </ToastAction>
        ) : undefined,
      });
    },
    [toast],
  );

  const showQueued = useCallback(
    ({ action, bookingLabel }: TransitionToastQueuedOptions) => {
      const label = bookingLabel ? `Booking ${bookingLabel}` : "A booking";
      const actionLabel = formatActionLabel(action);
      toast({
        title: `${label} queued`,
        description: `${actionLabel} will complete when you are back online.`,
      });
    },
    [toast],
  );

  return {
    showSuccess,
    showError,
    showExternalUpdate,
    showQueued,
    dismiss,
  };
}

export type TransitionToastApi = ReturnType<typeof useTransitionToast>;

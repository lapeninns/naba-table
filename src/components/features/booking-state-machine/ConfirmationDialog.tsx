"use client";

import { cloneElement, useMemo, useState, type ReactElement, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type TriggerProps = {
  onClick?: (event?: unknown) => void;
  disabled?: boolean;
  "aria-disabled"?: boolean;
};

type ConfirmationDialogProps = {
  trigger: ReactElement<TriggerProps>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => Promise<void> | void;
  onOpenChange?: (open: boolean) => void;
  onAfterClose?: () => void;
  disabled?: boolean;
  children?: ReactNode;
};

export function ConfirmationDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  pending = false,
  onConfirm,
  onOpenChange,
  onAfterClose,
  disabled = false,
  children,
}: ConfirmationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedTrigger = useMemo(() => {
    const originalOnClick = trigger.props.onClick;
    return cloneElement(trigger, {
      onClick: (event?: unknown) => {
        if (typeof originalOnClick === "function") {
          originalOnClick(event);
        }
        if (!disabled) {
          setOpen(true);
          onOpenChange?.(true);
        }
      },
      "aria-disabled": trigger.props["aria-disabled"] ?? disabled,
      disabled: trigger.props.disabled ?? disabled,
    });
  }, [trigger, disabled, onOpenChange]);

  const handleOpenChange = (next: boolean) => {
    if (disabled) return;
    setOpen(next);
    onOpenChange?.(next);
    if (!next) {
      onAfterClose?.();
    }
  };

  const handleConfirm = async () => {
    if (pending || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onConfirm();
      setOpen(false);
      onOpenChange?.(false);
      onAfterClose?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>{resolvedTrigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children ? <div className="py-2">{children}</div> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending || isSubmitting}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={pending || isSubmitting}>
            {pending || isSubmitting ? `${confirmLabel}…` : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

'use client';

import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { useConfirmationStep } from '@features/reservations/wizard/hooks/useConfirmationStep';
import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';

import { WizardStep } from '../WizardStep';

import type { ConfirmationStepProps } from './confirmation-step/types';

const STATUS_ICON_MAP = {
  confirmed: { Icon: CheckCircle2, className: 'text-emerald-500' },
  updated: { Icon: CheckCircle2, className: 'text-emerald-500' },
} as const;

const FEEDBACK_ICON_MAP = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
} as const;

export function ConfirmationStep(props: ConfirmationStepProps) {
  const controller = useConfirmationStep(props);
  const { status, handleClose } = controller;

  const { Icon: StatusIcon, className: statusIconClass } =
    controller.status === 'pending'
      ? { Icon: Info, className: 'text-blue-600' }
      : STATUS_ICON_MAP[controller.status];

  const FeedbackIcon = useMemo(() => {
    if (!controller.feedback) return null;
    return FEEDBACK_ICON_MAP[controller.feedback.variant];
  }, [controller.feedback]);

  // Auto-redirect to thank-you after 5s when pending, with visible countdown
  const [redirectIn, setRedirectIn] = useState<number | null>(null);
  useEffect(() => {
    if (status !== 'pending') {
      setRedirectIn(null);
      return;
    }
    setRedirectIn(5);
    const interval = setInterval(() => {
      setRedirectIn((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    const timeout = setTimeout(() => {
      handleClose();
    }, 5000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status, handleClose]);

  return (
    <WizardStep
      step={4}
      title={controller.heading}
      description={controller.description}
      icon={<StatusIcon className={`h-6 w-6 ${statusIconClass}`} aria-hidden />}
      contentClassName="space-y-6"
    >
      {controller.status === 'pending' ? (
        <div className="space-y-2" aria-live="polite">
          <p className="text-xs text-muted-foreground">
            It’s okay to leave this screen. We’ll send the confirmation via email.
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded bg-muted/50">
            <div
              className="h-full bg-blue-600 transition-[width] duration-1000 ease-linear"
              style={{ width: `${((5 - (redirectIn ?? 5)) / 5) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Redirecting to summary in {redirectIn ?? 5}s…
          </p>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {controller.status === 'pending'
          ? 'Reservation is being confirmed. Please wait.'
          : `Reference ${controller.reference}. Reservation for ${controller.partyText} at ${controller.summaryTime} on ${controller.summaryDate}.`}
      </p>
      {controller.feedback ? (
        <Alert
          variant={
            controller.feedback.variant === 'error'
              ? 'destructive'
              : controller.feedback.variant === 'warning'
                ? 'warning'
                : controller.feedback.variant === 'success'
                  ? 'success'
                  : 'info'
          }
          role={controller.feedback.variant === 'error' ? 'alert' : 'status'}
          className="items-start gap-3"
        >
          <AlertIcon>
            {FeedbackIcon ? <FeedbackIcon className="h-4 w-4" aria-hidden /> : null}
          </AlertIcon>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AlertDescription>{controller.feedback.message}</AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              onClick={controller.dismissFeedback}
              disabled={controller.isLoading}
              className="self-end sm:self-auto"
            >
              Dismiss
            </Button>
          </div>
        </Alert>
      ) : null}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reference</dt>
            <dd className="text-sm font-semibold text-foreground">{controller.reference}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Guest</dt>
            <dd className="text-sm font-semibold text-foreground">{controller.guestName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">When</dt>
            <dd className="text-sm font-medium text-foreground">
              {controller.summaryDate} at {controller.summaryTime}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Guests</dt>
            <dd className="text-sm font-medium text-foreground">{controller.partyText}</dd>
          </div>
        </dl>
      </div>
    </WizardStep>
  );
}

export type { ConfirmationStepProps } from './confirmation-step/types';

'use client';

import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useConfirmationStep } from '@features/reservations/wizard/hooks/useConfirmationStep';
import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';

import { useWizardNavigation } from '../../context/WizardContext';
import { StepErrorBoundary } from '../ErrorBoundary';
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

const AUTO_REDIRECT_SECONDS = 15;

export function ConfirmationStep(props: ConfirmationStepProps) {
  const controller = useConfirmationStep(props);
  const { status, handleClose } = controller;
  const { goToStep } = useWizardNavigation();

  const { Icon: StatusIcon, className: statusIconClass } =
    controller.status === 'pending'
      ? { Icon: Info, className: 'text-blue-600' }
      : STATUS_ICON_MAP[controller.status];

  const FeedbackIcon = useMemo(() => {
    if (!controller.feedback) return null;
    return FEEDBACK_ICON_MAP[controller.feedback.variant];
  }, [controller.feedback]);

  const [autoRedirectEnabled, setAutoRedirectEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return sessionStorage.getItem('autoRedirectEnabled') !== 'false';
  });
  const [redirectIn, setRedirectIn] = useState<number | null>(null);
  const [redirectCanceled, setRedirectCanceled] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return sessionStorage.getItem('autoRedirectEnabled') === 'false';
  });

  const handleCancelRedirect = useCallback(() => {
    setAutoRedirectEnabled(false);
    setRedirectCanceled(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('autoRedirectEnabled', 'false');
    }
  }, []);

  useEffect(() => {
    if (status !== 'pending' || !autoRedirectEnabled) {
      setRedirectIn(null);
      return;
    }

    setRedirectCanceled(false);
    setRedirectIn(AUTO_REDIRECT_SECONDS);

    const interval = window.setInterval(() => {
      setRedirectIn((prev) => {
        if (prev === null || prev <= 0) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const timeout = window.setTimeout(() => {
      if (autoRedirectEnabled) {
        handleClose();
      }
    }, AUTO_REDIRECT_SECONDS * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status, autoRedirectEnabled, handleClose]);

  return (
    <StepErrorBoundary
      stepName="Confirmation"
      onReset={() => {
        goToStep(4);
      }}
    >
      <WizardStep
        step={4}
        title={controller.heading}
        description={controller.description}
        icon={<StatusIcon className={`h-6 w-6 ${statusIconClass}`} aria-hidden />}
        contentClassName="space-y-6"
      >
        {controller.status === 'pending' ? (
          <div className="space-y-3" aria-live="polite">
            <p className="text-xs text-muted-foreground">
              It’s okay to leave this screen. We’ll send the confirmation via email.
            </p>
            {autoRedirectEnabled && !redirectCanceled ? (
              <>
                <div className="relative h-1.5 w-full overflow-hidden rounded bg-muted/50">
                  <div
                    className="h-full bg-blue-600 transition-[width] duration-1000 ease-linear"
                    style={{
                      width: `${
                        ((AUTO_REDIRECT_SECONDS - (redirectIn ?? AUTO_REDIRECT_SECONDS)) /
                          AUTO_REDIRECT_SECONDS) *
                        100
                      }%`,
                    }}
                    role="progressbar"
                    aria-label="Auto-redirect progress"
                    aria-valuemin={0}
                    aria-valuemax={AUTO_REDIRECT_SECONDS}
                    aria-valuenow={AUTO_REDIRECT_SECONDS - (redirectIn ?? AUTO_REDIRECT_SECONDS)}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Redirecting to summary in{' '}
                    <strong>{redirectIn ?? AUTO_REDIRECT_SECONDS}s</strong>
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelRedirect}
                    className="h-7 text-xs"
                  >
                    Cancel redirect
                  </Button>
                </div>
                <div className="sr-only" role="status" aria-live="polite">
                  Automatically redirecting in {redirectIn ?? AUTO_REDIRECT_SECONDS} seconds. Press
                  cancel redirect to stay on this page.
                </div>
              </>
            ) : redirectCanceled ? (
              <Alert variant="info" className="border border-dashed">
                <AlertIcon>
                  <Info className="h-4 w-4" aria-hidden />
                </AlertIcon>
                <AlertDescription>
                  Auto-redirect canceled. You can close this manually when ready.
                </AlertDescription>
              </Alert>
            ) : null}
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
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Reference
              </dt>
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
    </StepErrorBoundary>
  );
}

export type { ConfirmationStepProps } from './confirmation-step/types';

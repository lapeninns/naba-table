'use client';

import { CheckCircle2, Info, AlertTriangle, XCircle } from 'lucide-react';
import React, { useMemo } from 'react';

import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useConfirmationStep } from '@features/reservations/wizard/hooks/useConfirmationStep';

import { useWizardNavigation } from '../../context/WizardContext';
import { BookingConfirmationActions } from '../BookingConfirmationActions';
import { StepErrorBoundary } from '../ErrorBoundary';
import { WizardStep } from '../WizardStep';

import type { ConfirmationStepProps } from './confirmation-step/types';

const FEEDBACK_ICON_MAP = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
} as const;

export function ConfirmationStep(props: ConfirmationStepProps) {
  const controller = useConfirmationStep(props);
  const { status, reservationWindow } = controller;
  const { goToStep } = useWizardNavigation();

  const FeedbackIcon = useMemo(() => {
    if (!controller.feedback) return null;
    return FEEDBACK_ICON_MAP[controller.feedback.variant];
  }, [controller.feedback]);

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
        icon={
          status === 'confirmed' || status === 'updated' ? (
            <CheckCircle2 className="h-6 w-6 text-primary" />
          ) : (
            <Info className="h-6 w-6 text-primary" />
          )
        }
        contentClassName="space-y-6"
      >
        <div className="space-y-6">
          {status !== 'pending' && reservationWindow && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200">
              <BookingConfirmationActions
                restaurantName={controller.venue.name}
                restaurantAddress={controller.venue.address}
                start={reservationWindow.start}
                end={reservationWindow.end}
                partySize={controller.booking?.party_size ?? controller.details.party}
                bookingRef={controller.reference}
                onDownloadIcs={controller.handleAddToCalendar}
              />
            </div>
          )}

          {controller.feedback &&
            (controller.feedback.variant !== 'success' || !status.match(/confirmed|updated/)) && (
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
                className="animate-fade-in"
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
                    className="self-end sm:self-auto"
                  >
                    Dismiss
                  </Button>
                </div>
              </Alert>
            )}

          <div className="pg-panel animate-in overflow-hidden fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <div className="border-b border-border/70 bg-muted/40 px-5 py-4 sm:px-6">
              <p className="pg-kicker">Keep this reference</p>
              <p className="mt-1 font-[var(--pg-font-mono)] text-2xl font-semibold tracking-tight text-foreground">
                {controller.reference}
              </p>
            </div>
            <dl className="grid gap-0 divide-y divide-border/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                ['Guest', controller.guestName],
                ['When', `${controller.summaryDate} · ${controller.summaryTime}`],
                ['Size', controller.partyText],
              ].map(([label, value]) => (
                <div key={label} className="p-5 sm:p-6">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-2 text-base font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {status !== 'pending' && (
            <p className="rounded-[var(--pg-radius-md)] border border-border bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
              Need to make changes? You can manage your booking via the link sent to your email.
            </p>
          )}
        </div>
      </WizardStep>
    </StepErrorBoundary>
  );
}

export type { ConfirmationStepProps } from './confirmation-step/types';

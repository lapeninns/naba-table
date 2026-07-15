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

import type { ConfirmationStatus, ConfirmationStepProps } from './confirmation-step/types';

const FEEDBACK_ICON_MAP = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
} as const;

const REFERENCE_HEADER_CLASSES = {
  pending: 'border-b border-warning/40 bg-warning/10 px-4 py-4 sm:px-6',
  confirmed: 'border-b border-primary/20 bg-primary/10 px-4 py-4 sm:px-6',
  updated: 'border-b border-primary/20 bg-primary/10 px-4 py-4 sm:px-6',
} as const satisfies Record<ConfirmationStatus, string>;

export function ConfirmationStep(props: ConfirmationStepProps) {
  const controller = useConfirmationStep(props);
  const { status, reservationWindow } = controller;
  const { goToStep } = useWizardNavigation();
  const referenceHeadingId = React.useId();

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
            <CheckCircle2 className="size-6 text-primary" />
          ) : (
            <Info className="size-6 text-primary" />
          )
        }
        contentClassName="space-y-6"
      >
        <div className="space-y-6">
          <section
            aria-labelledby={referenceHeadingId}
            data-confirmation-status={status}
            className="pg-panel motion-safe:animate-in overflow-hidden motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700"
          >
            <div className={REFERENCE_HEADER_CLASSES[status]}>
              <h3 id={referenceHeadingId} className="pg-kicker">
                Booking reference
              </h3>
              <p className="mt-1 font-[var(--pg-font-mono)] text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-3xl">
                {controller.reference}
              </p>
            </div>
            <dl className="grid gap-0 divide-y divide-border/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                ['Guest', controller.guestName],
                ['When', `${controller.summaryDate} · ${controller.summaryTime}`],
                ['Size', controller.partyText],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 px-4 py-4 sm:px-5 sm:py-5">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-1.5 break-words text-base font-semibold text-foreground">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {status !== 'pending' && reservationWindow && (
            <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700 motion-safe:delay-150">
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
                  {FeedbackIcon ? <FeedbackIcon className="size-4" aria-hidden /> : null}
                </AlertIcon>
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <AlertDescription>{controller.feedback.message}</AlertDescription>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={controller.dismissFeedback}
                    className="min-h-11 self-stretch sm:self-auto"
                  >
                    Dismiss
                  </Button>
                </div>
              </Alert>
            )}

          {status !== 'pending' && (
            <p className="scroll-mb-48 rounded-[var(--pg-radius-md)] border border-border bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground sm:scroll-mb-32">
              Need to make changes? You can manage your booking via the link sent to your email.
            </p>
          )}
        </div>
      </WizardStep>
    </StepErrorBoundary>
  );
}

export type { ConfirmationStepProps } from './confirmation-step/types';

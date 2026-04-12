'use client';

import { CheckCircle2, Info, AlertTriangle, XCircle } from 'lucide-react';
import React, { useMemo } from 'react';

import { useConfirmationStep } from '@features/reservations/wizard/hooks/useConfirmationStep';
import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';

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
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          ) : (
            <Info className="h-6 w-6 text-blue-500" />
          )
        }
        contentClassName="space-y-5"
      >
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
            <div className="luminous-card rounded-[var(--luminous-radius)] p-4 sm:p-5">
              <div className="space-y-1">
                <p className="luminous-kicker">Reservation snapshot</p>
                <p className="text-sm font-semibold text-foreground">
                  Everything you need is ready below.
                </p>
              </div>

              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="luminous-card-soft rounded-[calc(var(--luminous-radius)+2px)] px-4 py-4">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Reference
                  </dt>
                  <dd className="mt-1 text-lg font-mono font-semibold tracking-tight text-foreground">
                    {controller.reference}
                  </dd>
                </div>
                <div className="luminous-card-soft rounded-[calc(var(--luminous-radius)+2px)] px-4 py-4">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Guest
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-foreground">
                    {controller.guestName}
                  </dd>
                </div>
                <div className="luminous-card-soft rounded-[calc(var(--luminous-radius)+2px)] px-4 py-4 sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    When
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-foreground">
                    {controller.summaryDate}
                    <span className="block text-sm font-normal text-muted-foreground">
                      {controller.summaryTime}
                    </span>
                  </dd>
                </div>
                <div className="luminous-card-soft rounded-[calc(var(--luminous-radius)+2px)] px-4 py-4">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Party size
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-foreground">
                    {controller.partyText}
                  </dd>
                </div>
                <div className="luminous-card-soft rounded-[calc(var(--luminous-radius)+2px)] px-4 py-4">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Venue
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-foreground">
                    {controller.venue.name}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-4">
              {status !== 'pending' && reservationWindow && (
                <div className="animate-in slide-in-from-bottom-2 fade-in duration-700 delay-200">
                  <BookingConfirmationActions
                    restaurantName={controller.venue.name}
                    restaurantAddress={controller.venue.address}
                    date={reservationWindow.start}
                    partySize={controller.booking?.party_size ?? controller.details.party}
                    bookingRef={controller.reference}
                    onDownloadIcs={controller.handleAddToCalendar}
                  />
                </div>
              )}

              <div className="luminous-card rounded-[var(--luminous-radius)] px-4 py-4">
                <p className="luminous-kicker">Manage later</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Need to make changes? You can manage your booking via the link sent to your email.
                </p>
              </div>
            </div>
          </div>

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
        </div>
      </WizardStep>
    </StepErrorBoundary>
  );
}

export type { ConfirmationStepProps } from './confirmation-step/types';

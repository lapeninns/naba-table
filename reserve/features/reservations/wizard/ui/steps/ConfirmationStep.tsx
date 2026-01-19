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
        contentClassName="space-y-6"
      >
        <div className="space-y-6">
          {/* Status Banner - REMOVED redundant GuestStatus, using WizardStep header instead */}

          {/* Actions Bar (Add to Calendar, Directions) */}
          {status !== 'pending' && reservationWindow && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200">
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

          {/* Feedback Alert - Only show if transient/error or if unrelated to main status */}
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

          {/* Reservation Details Card */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <dl className="grid gap-6 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Reference
                </dt>
                <dd className="mt-1 text-lg font-mono font-semibold text-foreground tracking-tight">
                  {controller.reference}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Guest
                </dt>
                <dd className="mt-1 text-base font-semibold text-foreground">
                  {controller.guestName}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  When
                </dt>
                <dd className="mt-1 text-base font-medium text-foreground">
                  {controller.summaryDate}
                  <span className="block text-sm text-muted-foreground">
                    {controller.summaryTime}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Size
                </dt>
                <dd className="mt-1 text-base font-medium text-foreground">
                  {controller.partyText}
                </dd>
              </div>
            </dl>
          </div>

          {/* Links / Info */}
          {status !== 'pending' && (
            <p className="text-center text-xs text-muted-foreground pt-4">
              Need to make changes? You can manage your booking via the link sent to your email.
            </p>
          )}
        </div>
      </WizardStep>
    </StepErrorBoundary>
  );
}

export type { ConfirmationStepProps } from './confirmation-step/types';

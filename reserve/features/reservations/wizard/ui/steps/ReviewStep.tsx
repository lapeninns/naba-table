'use client';

import { AlertTriangle } from 'lucide-react';
import React from 'react';

import { useReviewStep } from '@features/reservations/wizard/hooks/useReviewStep';
import { formatBookingLabel } from '@reserve/shared/formatting/booking';
import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';

import { useWizardNavigation } from '../../context/WizardContext';
import { StepErrorBoundary } from '../ErrorBoundary';
import { WizardStep } from '../WizardStep';

import type { ReviewStepProps } from './review-step/types';

export function ReviewStep(props: ReviewStepProps) {
  const { details, summary, error } = useReviewStep(props);
  const { goToStep } = useWizardNavigation();
  const emailDisplay = details.email?.trim() ? details.email : 'Not provided';
  const phoneDisplay = details.phone?.trim() ? details.phone : 'Not provided';

  return (
    <StepErrorBoundary
      stepName="Review and confirm"
      onReset={() => {
        goToStep(3);
      }}
    >
      <WizardStep
        step={3}
        title="Review and confirm"
        description="Double-check the details below. You can edit any section before confirming."
        contentClassName="space-y-4"
      >
        <div className="space-y-4">
          <p className="sr-only" aria-live="polite">
            {`Review details for ${summary.summaryValue}. Press confirm to finalise your reservation.`}
          </p>
          {error ? (
            <Alert variant="destructive" role="alert" className="items-start">
              <AlertIcon>
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </AlertIcon>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <dl className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Summary</dt>
              <dd className="text-sm font-semibold text-foreground">{summary.summaryValue}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Venue</dt>
              <dd className="text-sm font-medium text-foreground">{details.restaurantName}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Party size
              </dt>
              <dd className="text-sm font-medium text-foreground">
                {details.party} {details.party === 1 ? 'guest' : 'guests'}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Full name
              </dt>
              <dd className="text-sm font-medium text-foreground">{details.name}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Email</dt>
              <dd className="text-sm font-medium text-foreground">{emailDisplay}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Phone</dt>
              <dd className="text-sm font-medium text-foreground">{phoneDisplay}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Booking type
              </dt>
              <dd className="text-sm font-medium text-foreground">
                {formatBookingLabel(details.bookingType)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Marketing updates
              </dt>
              <dd className="text-sm font-medium text-foreground">
                {details.marketingOptIn ? 'Subscribed' : 'Not subscribed'}
              </dd>
            </div>
            {details.notes ? (
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Notes</dt>
                <dd className="text-sm text-muted-foreground">{details.notes}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </WizardStep>
    </StepErrorBoundary>
  );
}

export type { ReviewStepProps } from './review-step/types';

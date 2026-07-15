'use client';

import { AlertTriangle, ReceiptIcon } from 'lucide-react';
import React from 'react';

import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useReviewStep } from '@features/reservations/wizard/hooks/useReviewStep';
import { formatReservationTime } from '@reserve/shared/formatting/booking';

import { useWizardNavigation } from '../../context/WizardContext';
import { StepErrorBoundary } from '../ErrorBoundary';
import { WizardStep } from '../WizardStep';
import { ReviewSummaryPanel } from './review-step/ReviewSummary';

import type { ReviewStepProps } from './review-step/types';
import type { BookingSubmissionUiError } from '@reserve/shared/error';

type SubmissionAlertProps = {
  readonly error: string;
  readonly submissionError: BookingSubmissionUiError | null;
  readonly onAlternativeSelect: (time: string) => void;
};

function SubmissionAlert({ error, submissionError, onAlternativeSelect }: SubmissionAlertProps) {
  const alternativesTitleId = React.useId();
  const alternativeSlots = submissionError?.alternatives ?? [];

  return (
    <Alert variant="destructive" role="alert" className="min-w-0 items-start animate-fade-in">
      <AlertIcon>
        <AlertTriangle className="size-4" aria-hidden />
      </AlertIcon>
      <AlertDescription aria-live="polite" className="min-w-0">
        <div className="min-w-0 space-y-3">
          <p className="break-words [overflow-wrap:anywhere]">
            {submissionError?.message ?? error}
          </p>

          {submissionError?.retryable ? (
            <p className="break-words text-xs text-destructive/90 [overflow-wrap:anywhere]">
              That slot changed while you were booking. You can retry right away or choose another
              nearby time.
              {submissionError.retryAfter
                ? ` Suggested retry window: ${submissionError.retryAfter} second${submissionError.retryAfter === 1 ? '' : 's'}.`
                : ''}
            </p>
          ) : null}

          {alternativeSlots.length > 0 ? (
            <div className="min-w-0 space-y-2">
              <p id={alternativesTitleId} className="text-xs font-semibold text-destructive/90">
                Nearby availability
              </p>
              <div
                role="group"
                aria-labelledby={alternativesTitleId}
                className="flex min-w-0 flex-wrap gap-2"
              >
                {alternativeSlots.map((slot) => (
                  <Button
                    key={slot.time}
                    type="button"
                    size="guest-lg"
                    variant="guest-outline"
                    className="min-h-11 border-destructive/30 bg-background text-foreground hover:bg-destructive/5"
                    onClick={() => onAlternativeSelect(slot.time)}
                  >
                    {formatReservationTime(slot.time)}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function ReviewStep(props: ReviewStepProps) {
  const { details, summary, error, submissionError, handleAlternativeSelect } =
    useReviewStep(props);
  const { goToStep } = useWizardNavigation();
  const isOpsMode = props.mode === 'ops';

  return (
    <StepErrorBoundary stepName="Review and confirm" onReset={() => goToStep(3)}>
      <WizardStep
        step={3}
        title="Review the booking"
        description="Check the visit, contact details, and notes before the restaurant receives it."
        contentClassName="space-y-5"
        icon={<ReceiptIcon className="size-6" />}
      >
        <p className="sr-only" aria-live="polite">
          {`Review details for ${summary.summaryValue}. Press confirm to finalise your reservation.`}
        </p>

        {error ? (
          <SubmissionAlert
            error={error}
            submissionError={submissionError}
            onAlternativeSelect={handleAlternativeSelect}
          />
        ) : null}

        <ReviewSummaryPanel
          details={details}
          summary={summary}
          isOpsMode={isOpsMode}
          onEditPlan={() => goToStep(1)}
          onEditDetails={() => goToStep(2)}
        />
      </WizardStep>
    </StepErrorBoundary>
  );
}

export type { ReviewStepProps } from './review-step/types';

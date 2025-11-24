'use client';

import {
  AlertTriangle,
  CalendarIcon,
  ClockIcon,
  MailIcon,
  PhoneIcon,
  SparklesIcon,
  UserIcon,
  UsersIcon,
  MessageSquareIcon,
  BellIcon,
} from 'lucide-react';
import React from 'react';

import { useReviewStep } from '@features/reservations/wizard/hooks/useReviewStep';
import { formatBookingLabel } from '@reserve/shared/formatting/booking';
import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';

import { useWizardNavigation } from '../../context/WizardContext';
import { StepErrorBoundary } from '../ErrorBoundary';
import { WizardStep } from '../WizardStep';

import type { ReviewStepProps } from './review-step/types';

type DetailItemProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
};

function DetailItem({ icon, label, value, className }: DetailItemProps) {
  return (
    <div className={`space-y-2 ${className || ''}`}>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
        <span>{label}</span>
      </dt>
      <dd className="text-sm font-semibold text-foreground sm:text-base">{value}</dd>
    </div>
  );
}

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
        contentClassName="space-y-5"
      >
        <div className="space-y-5">
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
          <dl className="grid gap-5 rounded-2xl border border-border bg-gradient-to-br from-card/95 to-card/80 p-5 shadow-md backdrop-blur-sm sm:grid-cols-2 sm:gap-6 sm:p-6 lg:grid-cols-3">
            <DetailItem
              icon={<CalendarIcon className="h-3.5 w-3.5" />}
              label="Summary"
              value={summary.summaryValue}
              className="sm:col-span-2 lg:col-span-1"
            />
            <DetailItem
              icon={<SparklesIcon className="h-3.5 w-3.5" />}
              label="Venue"
              value={details.restaurantName}
            />
            <DetailItem
              icon={<UsersIcon className="h-3.5 w-3.5" />}
              label="Party size"
              value={`${details.party} ${details.party === 1 ? 'guest' : 'guests'}`}
            />
            <DetailItem
              icon={<UserIcon className="h-3.5 w-3.5" />}
              label="Full name"
              value={details.name}
            />
            <DetailItem
              icon={<MailIcon className="h-3.5 w-3.5" />}
              label="Email"
              value={emailDisplay}
            />
            <DetailItem
              icon={<PhoneIcon className="h-3.5 w-3.5" />}
              label="Phone"
              value={phoneDisplay}
            />
            <DetailItem
              icon={<ClockIcon className="h-3.5 w-3.5" />}
              label="Booking type"
              value={formatBookingLabel(details.bookingType)}
            />
            <DetailItem
              icon={<BellIcon className="h-3.5 w-3.5" />}
              label="Marketing updates"
              value={details.marketingOptIn ? 'Subscribed' : 'Not subscribed'}
            />
            {details.notes ? (
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <dt className="flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <MessageSquareIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Notes</span>
                </dt>
                <dd className="text-sm text-muted-foreground leading-relaxed">{details.notes}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </WizardStep>
    </StepErrorBoundary>
  );
}

export type { ReviewStepProps } from './review-step/types';

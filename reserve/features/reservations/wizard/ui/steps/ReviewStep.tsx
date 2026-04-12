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
  PencilIcon,
  ReceiptIcon,
  MapPinIcon,
} from 'lucide-react';
import React from 'react';

import { useReviewStep } from '@features/reservations/wizard/hooks/useReviewStep';
import { formatBookingLabel } from '@reserve/shared/formatting/booking';
import { cn } from '@shared/lib/cn';
import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';

import { useWizardNavigation } from '../../context/WizardContext';
import { StepErrorBoundary } from '../ErrorBoundary';
import { WizardStep } from '../WizardStep';

import type { ReviewStepProps } from './review-step/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DetailItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  onEdit?: () => void;
  editLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ title, icon, onEdit, editLabel }: SectionHeaderProps) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h3>
      </div>
      {onEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-7 gap-1.5 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/5"
          aria-label={editLabel ?? `Edit ${title.toLowerCase()}`}
        >
          <PencilIcon className="h-3.5 w-3.5" aria-hidden />
          <span>Edit</span>
        </Button>
      )}
    </div>
  );
}

function DetailItem({ icon, label, value, className, valueClassName }: DetailItemProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <dt
        className={cn(
          'flex items-center gap-1.5',
          'text-xs uppercase tracking-wider text-muted-foreground/80 font-medium',
        )}
      >
        <span className="shrink-0 text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
        <span>{label}</span>
      </dt>
      <dd
        className={cn('text-sm font-semibold text-foreground sm:text-base/relaxed', valueClassName)}
      >
        {value}
      </dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function ReviewStep(props: ReviewStepProps) {
  const { details, summary, error } = useReviewStep(props);
  const { goToStep } = useWizardNavigation();

  const emailDisplay = details.email?.trim() ? details.email : 'Not provided';
  const phoneDisplay = details.phone?.trim() ? details.phone : 'Not provided';

  // Navigation handlers for edit buttons
  const handleEditPlan = () => goToStep(1);
  const handleEditDetails = () => goToStep(2);

  return (
    <StepErrorBoundary
      stepName="Review and confirm"
      onReset={() => {
        goToStep(3);
      }}
    >
      <WizardStep
        step={3}
        title="Review & Confirm"
        description="Please review your reservation details below."
        contentClassName="space-y-5"
        icon={<ReceiptIcon className="h-6 w-6" />}
      >
        <div className="space-y-5">
          {/* Screen reader summary */}
          <p className="sr-only" aria-live="polite">
            {`Review details for ${summary.summaryValue}. Press confirm to finalise your reservation.`}
          </p>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" role="alert" className="items-start animate-fade-in">
              <AlertIcon>
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </AlertIcon>
              <AlertDescription aria-live="polite">{error}</AlertDescription>
            </Alert>
          )}

          {/* 
            TICKET CONTAINER 
            Using a clean card look with a "perforation" divider
          */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* SECTION 1: Plan */}
            <div className="luminous-card rounded-[var(--luminous-radius)] p-4 sm:p-5">
              <SectionHeader
                title="Your Visit"
                icon={<SparklesIcon className="h-4 w-4" />}
                onEdit={handleEditPlan}
                editLabel="Edit reservation details"
              />

              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailItem
                  icon={<CalendarIcon className="h-4 w-4" />}
                  label="Date & Time"
                  value={summary.summaryValue}
                  className="sm:col-span-2"
                  valueClassName="text-lg text-primary"
                />
                <DetailItem
                  icon={<MapPinIcon className="h-4 w-4" />}
                  label="Venue"
                  value={details.restaurantName}
                />
                <DetailItem
                  icon={<UsersIcon className="h-4 w-4" />}
                  label="Party size"
                  value={`${details.party} ${details.party === 1 ? 'guest' : 'guests'}`}
                />
                <DetailItem
                  icon={<ClockIcon className="h-4 w-4" />}
                  label="Booking type"
                  value={formatBookingLabel(details.bookingType)}
                />
              </dl>
            </div>

            {/* SECTION 2: Details */}
            <div className="luminous-card rounded-[var(--luminous-radius)] p-4 sm:p-5">
              <SectionHeader
                title="Your Details"
                icon={<UserIcon className="h-4 w-4" />}
                onEdit={handleEditDetails}
                editLabel="Edit guest details"
              />

              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailItem
                  icon={<UserIcon className="h-4 w-4" />}
                  label="Full name"
                  value={details.name}
                />
                <DetailItem
                  icon={<MailIcon className="h-4 w-4" />}
                  label="Email"
                  value={emailDisplay}
                />
                <DetailItem
                  icon={<PhoneIcon className="h-4 w-4" />}
                  label="Phone"
                  value={phoneDisplay}
                />
                <DetailItem
                  icon={<BellIcon className="h-4 w-4" />}
                  label="Marketing"
                  value={details.marketingOptIn ? 'Subscribed' : 'Not subscribed'}
                />
              </dl>

              {/* Notes - Full Width */}
              {details.notes && (
                <div className="mt-4 rounded-[var(--luminous-radius)] bg-[var(--luminous-surface-low)] p-4">
                  <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
                    <MessageSquareIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Special Requests</span>
                  </dt>
                  <dd className="text-sm text-foreground/90">&quot;{details.notes}&quot;</dd>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[var(--luminous-radius)] bg-[var(--luminous-surface-low)] px-4 py-3 text-center text-xs text-muted-foreground">
            By clicking Confirm, you agree to our Terms of Service and Privacy Policy.
          </div>
        </div>
      </WizardStep>
    </StepErrorBoundary>
  );
}

export type { ReviewStepProps } from './review-step/types';

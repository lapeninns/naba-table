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
import { formatReservationTime } from '@reserve/shared/formatting/booking';
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
    <div className="flex items-center justify-between gap-3 mb-5 border-b border-border/40 pb-3">
      <div className="flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
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

function TicketPerforation() {
  return (
    <div className="relative h-px w-full bg-border my-2" aria-hidden="true">
      {/* Left Notch */}
      <div className="absolute -left-6 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-background border border-border" />
      <div className="absolute -left-6 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-background scale-90" />{' '}
      {/* Mask border overlap */}
      {/* Right Notch */}
      <div className="absolute -right-6 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-background border border-border" />
      <div className="absolute -right-6 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-background scale-90" />
      {/* Dashed Line */}
      <div className="absolute inset-0 border-t-2 border-dashed border-muted-foreground/20" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function ReviewStep(props: ReviewStepProps) {
  const { details, summary, error, submissionError, handleAlternativeSelect } =
    useReviewStep(props);
  const { goToStep } = useWizardNavigation();

  const emailDisplay = details.email?.trim() ? details.email : 'Not provided';
  const phoneDisplay = details.phone?.trim() ? details.phone : 'Not provided';
  const alternativeSlots = submissionError?.alternatives ?? [];

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
        contentClassName="space-y-6"
        icon={<ReceiptIcon className="h-6 w-6" />}
      >
        <div className="space-y-6">
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
              <AlertDescription aria-live="polite">
                <div className="space-y-3">
                  <p>{submissionError?.message ?? error}</p>

                  {submissionError?.retryable && (
                    <p className="text-xs text-destructive/90">
                      That slot changed while you were booking. You can retry right away or choose
                      another nearby time.
                      {submissionError.retryAfter
                        ? ` Suggested retry window: ${submissionError.retryAfter} second${submissionError.retryAfter === 1 ? '' : 's'}.`
                        : ''}
                    </p>
                  )}

                  {alternativeSlots.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-destructive/90">
                        Nearby availability
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {alternativeSlots.map((slot) => (
                          <Button
                            key={slot.time}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-destructive/30 bg-background text-foreground hover:bg-destructive/5"
                            onClick={() => handleAlternativeSelect(slot.time)}
                          >
                            {formatReservationTime(slot.time)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* 
            TICKET CONTAINER 
            Using a clean card look with a "perforation" divider
          */}
          <article className="pg-card overflow-hidden">
            {/* SECTION 1: Plan */}
            <div className="p-6">
              <SectionHeader
                title="Your Visit"
                icon={<SparklesIcon className="h-4 w-4" />}
                onEdit={handleEditPlan}
                editLabel="Edit reservation details"
              />

              <dl className="grid gap-6 sm:grid-cols-2">
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

            {/* Perforation Divider */}
            <TicketPerforation />

            {/* SECTION 2: Details */}
            <div className="p-6">
              <SectionHeader
                title="Your Details"
                icon={<UserIcon className="h-4 w-4" />}
                onEdit={handleEditDetails}
                editLabel="Edit guest details"
              />

              <dl className="grid gap-6 sm:grid-cols-2">
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
                <div className="mt-6 pt-4 border-t border-border/40">
                  <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
                    <MessageSquareIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Special Requests</span>
                  </dt>
                  <dd className="text-sm text-foreground/90 bg-muted/40 p-3 rounded-lg border border-border/50">
                    &quot;{details.notes}&quot;
                  </dd>
                </div>
              )}
            </div>
          </article>

          <div className="text-center text-xs text-muted-foreground px-4">
            By clicking Confirm, you agree to our Terms of Service and Privacy Policy.
          </div>
        </div>
      </WizardStep>
    </StepErrorBoundary>
  );
}

export type { ReviewStepProps } from './review-step/types';

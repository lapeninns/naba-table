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
  Pencil,
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
}

interface SectionHeaderProps {
  title: string;
  onEdit?: () => void;
  editLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TICKET_CONTAINER_CLASSES = cn(
  // Ticket/receipt metaphor
  'rounded-2xl border border-border overflow-hidden',
  'bg-gradient-to-br from-slate-50 to-white',
  'dark:from-slate-900 dark:to-slate-950',
  'shadow-lg',
);

const SECTION_CLASSES = cn('p-5 sm:p-6');

const DASHED_SEPARATOR_CLASSES = cn(
  'border-t-2 border-dashed border-slate-200 dark:border-slate-700',
  'relative',
);

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ title, onEdit, editLabel }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {title}
      </h3>
      {onEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-8 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label={editLabel ?? `Edit ${title.toLowerCase()}`}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          <span>Edit</span>
        </Button>
      )}
    </div>
  );
}

function DetailItem({ icon, label, value, className }: DetailItemProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <dt
        className={cn(
          'flex items-center gap-1.5',
          'text-xs uppercase tracking-[0.15em] text-muted-foreground',
        )}
      >
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
        <span>{label}</span>
      </dt>
      <dd className="text-sm font-semibold text-foreground sm:text-base">{value}</dd>
    </div>
  );
}

function DashedDivider() {
  return (
    <div className={DASHED_SEPARATOR_CLASSES} aria-hidden="true">
      {/* Decorative notches for ticket effect */}
      <div className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background" />
      <div className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background" />
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
        title="Review and confirm"
        description="Double-check the details below. You can edit any section before confirming."
        contentClassName="space-y-5"
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

          {/* ═══════════════════════════════════════════════════════════════════
              TICKET/RECEIPT METAPHOR CONTAINER
          ═══════════════════════════════════════════════════════════════════ */}
          <article className={TICKET_CONTAINER_CLASSES}>
            {/* ─────────────────────────────────────────────────────────────────
                SECTION 1: Reservation Summary
            ───────────────────────────────────────────────────────────── */}
            <section className={SECTION_CLASSES}>
              <SectionHeader
                title="Reservation Summary"
                onEdit={handleEditPlan}
                editLabel="Edit reservation details"
              />

              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem
                  icon={<CalendarIcon className="h-3.5 w-3.5" />}
                  label="When"
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
                  icon={<ClockIcon className="h-3.5 w-3.5" />}
                  label="Booking type"
                  value={formatBookingLabel(details.bookingType)}
                />
              </dl>
            </section>

            {/* Dashed Divider with Ticket Notches */}
            <DashedDivider />

            {/* ─────────────────────────────────────────────────────────────────
                SECTION 2: Guest Details
            ───────────────────────────────────────────────────────────── */}
            <section className={SECTION_CLASSES}>
              <SectionHeader
                title="Guest Details"
                onEdit={handleEditDetails}
                editLabel="Edit guest details"
              />

              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  icon={<BellIcon className="h-3.5 w-3.5" />}
                  label="Marketing updates"
                  value={details.marketingOptIn ? 'Subscribed' : 'Not subscribed'}
                />
              </dl>

              {/* Notes - Full Width */}
              {details.notes && (
                <div className="mt-5 pt-4 border-t border-border/50">
                  <dl>
                    <div className="space-y-1.5">
                      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                        <MessageSquareIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Notes</span>
                      </dt>
                      <dd className="text-sm text-muted-foreground leading-relaxed">
                        {details.notes}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </section>
          </article>
        </div>
      </WizardStep>
    </StepErrorBoundary>
  );
}

export type { ReviewStepProps } from './review-step/types';

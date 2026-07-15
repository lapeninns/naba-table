'use client';

import {
  BellIcon,
  CalendarIcon,
  ClockIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareIcon,
  PencilIcon,
  PhoneIcon,
  SparklesIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatBookingLabel } from '@reserve/shared/formatting/booking';
import { cn } from '@shared/lib/cn';

import {
  WizardPanel,
  WizardPanelContent,
  WizardPanelFooter,
  WizardPanelHeader,
} from '../../WizardPanel';

import type { ReviewSummary } from './types';
import type { State } from '../../../model/reducer';
import type { ReactNode } from 'react';

type DetailItemProps = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
  readonly className?: string;
  readonly valueClassName?: string;
};

type SummarySectionProps = {
  readonly title: string;
  readonly icon: ReactNode;
  readonly editLabel: string;
  readonly onEdit: () => void;
  readonly children: ReactNode;
};

type ReviewSummaryPanelProps = {
  readonly details: State['details'];
  readonly summary: ReviewSummary;
  readonly isOpsMode: boolean;
  readonly onEditPlan: () => void;
  readonly onEditDetails: () => void;
};

function DetailItem({ icon, label, value, className, valueClassName }: DetailItemProps) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="shrink-0 text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
        <span>{label}</span>
      </dt>
      <dd
        className={cn(
          'break-words text-sm font-semibold text-foreground [overflow-wrap:anywhere] sm:text-base/relaxed',
          valueClassName,
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function SummarySection({ title, icon, editLabel, onEdit, children }: SummarySectionProps) {
  const titleId = React.useId();

  return (
    <section aria-labelledby={titleId} className="min-w-0 space-y-5 px-4 py-5 sm:px-5 sm:py-6">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-[var(--pg-radius-md)] bg-primary/10 text-primary"
            aria-hidden="true"
          >
            {icon}
          </span>
          <h3 id={titleId} className="text-sm font-semibold text-foreground sm:text-base">
            {title}
          </h3>
        </div>
        <Button
          variant="guest-ghost"
          size="guest-sm"
          onClick={onEdit}
          className="min-h-11 shrink-0 px-3"
          aria-label={editLabel}
        >
          <PencilIcon data-icon="inline-start" aria-hidden />
          <span>Edit</span>
        </Button>
      </div>
      {children}
    </section>
  );
}

export function ReviewSummaryPanel({
  details,
  summary,
  isOpsMode,
  onEditPlan,
  onEditDetails,
}: ReviewSummaryPanelProps) {
  const emailDisplay = details.email.trim() ? details.email : 'Not provided';
  const phoneDisplay = details.phone.trim() ? details.phone : 'Not provided';

  return (
    <article aria-label="Booking summary" data-slot="review-summary" className="min-w-0">
      <WizardPanel className="overflow-hidden">
        <WizardPanelHeader
          eyebrow="Reservation draft"
          title={summary.summaryValue}
          actions={<Badge variant="guest-chip-outline">Review</Badge>}
        />
        <WizardPanelContent className="p-0 sm:p-0">
          <SummarySection
            title="Your visit"
            icon={<SparklesIcon className="size-4" />}
            onEdit={onEditPlan}
            editLabel="Edit reservation details"
          >
            <dl className="grid min-w-0 gap-x-5 gap-y-5 sm:grid-cols-2">
              <DetailItem
                icon={<CalendarIcon className="size-4" />}
                label="Date and time"
                value={summary.summaryValue}
                className="sm:col-span-2"
                valueClassName="text-base text-primary sm:text-lg"
              />
              <DetailItem
                icon={<MapPinIcon className="size-4" />}
                label="Venue"
                value={details.restaurantName}
              />
              <DetailItem
                icon={<UsersIcon className="size-4" />}
                label="Party size"
                value={summary.partyText}
              />
              <DetailItem
                icon={<ClockIcon className="size-4" />}
                label="Booking type"
                value={formatBookingLabel(details.bookingType)}
              />
            </dl>
          </SummarySection>

          <Separator className="border-dashed border-border/70" />

          <SummarySection
            title={isOpsMode ? 'Guest details' : 'Your details'}
            icon={<UserIcon className="size-4" />}
            onEdit={onEditDetails}
            editLabel="Edit guest details"
          >
            <dl className="grid min-w-0 gap-x-5 gap-y-5 sm:grid-cols-2">
              <DetailItem
                icon={<UserIcon className="size-4" />}
                label="Full name"
                value={details.name}
              />
              <DetailItem
                icon={<MailIcon className="size-4" />}
                label="Email"
                value={emailDisplay}
              />
              <DetailItem
                icon={<PhoneIcon className="size-4" />}
                label="Phone"
                value={phoneDisplay}
              />
              <DetailItem
                icon={<MessageSquareIcon className="size-4" />}
                label="Mobile messages"
                value={
                  details.whatsappOptIn
                    ? 'WhatsApp booking messages + one post-visit review request · SMS backup for booking messages'
                    : 'SMS'
                }
              />
              {!isOpsMode ? (
                <DetailItem
                  icon={<BellIcon className="size-4" />}
                  label="Marketing"
                  value={details.marketingOptIn ? 'Subscribed' : 'Not subscribed'}
                />
              ) : null}
              {details.notes ? (
                <DetailItem
                  icon={<MessageSquareIcon className="size-4" />}
                  label="Special requests"
                  value={`“${details.notes}”`}
                  className="sm:col-span-2"
                  valueClassName="rounded-[var(--pg-radius-md)] bg-muted/45 p-3 font-normal"
                />
              ) : null}
            </dl>
          </SummarySection>
        </WizardPanelContent>

        {!isOpsMode ? (
          <WizardPanelFooter className="justify-center bg-muted/35 text-center text-xs text-muted-foreground">
            By clicking Confirm, you agree to the reservation terms and privacy notice.
          </WizardPanelFooter>
        ) : null}
      </WizardPanel>
    </article>
  );
}

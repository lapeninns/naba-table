'use client';

import { AlertTriangle } from 'lucide-react';
import React, { useCallback, useEffect } from 'react';

import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { bookingHelpers } from '@reserve/shared/utils/booking';
import { track } from '@shared/lib/analytics';

import type { State, StepAction } from '../../model/reducer';
import type { WizardActions } from '../../model/store';

interface ReviewStepProps {
  state: State;
  actions: Pick<WizardActions, 'goToStep'>;
  onConfirm: () => void | Promise<void>;
  onActionsChange: (actions: StepAction[]) => void;
}

export function ReviewStep({ state, actions, onConfirm, onActionsChange }: ReviewStepProps) {
  const details = state.details;

  useEffect(() => {
    if (details.date && details.time) {
      track('confirm_open', {
        date: details.date,
        time: details.time,
        party: details.party,
      });
    } else {
      track('confirm_open');
    }
  }, [details.date, details.time, details.party]);

  const summaryValue =
    details.date && details.time
      ? `${details.party} at ${bookingHelpers.formatTime(details.time)} on ${bookingHelpers.formatSummaryDate(details.date)}`
      : `${details.party} guest${details.party === 1 ? '' : 's'}`;

  const handleEdit = useCallback(() => {
    actions.goToStep(1);
  }, [actions]);

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  useEffect(() => {
    const stepActions: StepAction[] = [
      {
        id: 'review-edit',
        label: 'Edit details',
        icon: 'Pencil',
        variant: 'outline',
        onClick: handleEdit,
      },
      {
        id: 'review-confirm',
        label: state.submitting ? 'Processing…' : 'Confirm booking',
        icon: state.submitting ? undefined : 'Check',
        variant: 'default',
        disabled: state.submitting,
        loading: state.submitting,
        onClick: handleConfirm,
      },
    ];
    onActionsChange(stepActions);
  }, [handleEdit, handleConfirm, onActionsChange, state.submitting]);

  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-4">
        <CardTitle className="text-[clamp(1.75rem,1.45rem+0.6vw,2.2rem)] text-srx-ink-strong">
          Review and confirm
        </CardTitle>
        <CardDescription className="text-body-sm text-srx-ink-soft">
          Double-check the details below. You can edit any section before confirming.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="sr-only" aria-live="polite">
            {`Review details for ${summaryValue}. Press confirm to finalise your reservation.`}
          </p>
          {state.error ? (
            <Alert variant="destructive" role="alert" className="items-start">
              <AlertIcon>
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </AlertIcon>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <dl className="grid gap-4 rounded-2xl border border-srx-border-subtle bg-white/95 p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Summary</dt>
              <dd className="text-body-sm font-semibold text-srx-ink-strong">{summaryValue}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Venue</dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">
                {details.restaurantName}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">
                Party size
              </dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">
                {details.party} {details.party === 1 ? 'guest' : 'guests'}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">
                Full name
              </dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">{details.name}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Email</dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">{details.email}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Phone</dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">{details.phone}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">
                Booking type
              </dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">
                {bookingHelpers.formatBookingLabel(details.bookingType)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">
                Marketing updates
              </dt>
              <dd className="text-body-sm font-medium text-srx-ink-strong">
                {details.marketingOptIn ? 'Subscribed' : 'Not subscribed'}
              </dd>
            </div>
            {details.notes ? (
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-helper uppercase tracking-[0.18em] text-srx-ink-soft">Notes</dt>
                <dd className="text-body-sm text-srx-ink-soft">{details.notes}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

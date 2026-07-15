'use client';

import React, { Suspense } from 'react';

import { ConfirmationStep } from './steps/ConfirmationStep';
import { DetailsStepSkeleton, PlanStepSkeleton, ReviewStepSkeleton } from './WizardSkeletons';

import type { AnalyticsTracker } from '../di/types';
import type { AuthenticatedContactLocks } from '../hooks/useAuthenticatedContactLocks';
import type { useReservationWizard } from '../hooks/useReservationWizard';
import type { BookingWizardMode } from '../model/reducer';
import type { CalendarMask } from '@reserve/features/reservations/wizard/services/schedule';

const PlanStep = React.lazy(() =>
  import('./steps/PlanStep').then((module) => ({ default: module.PlanStep })),
);
const DetailsStep = React.lazy(() =>
  import('./steps/DetailsStep').then((module) => ({ default: module.DetailsStep })),
);
const ReviewStep = React.lazy(() =>
  import('./steps/ReviewStep').then((module) => ({ default: module.ReviewStep })),
);

type WizardController = ReturnType<typeof useReservationWizard>;

type BookingWizardStepContentProps = Pick<
  WizardController,
  | 'handleActionsChange'
  | 'handleClose'
  | 'handleConfirm'
  | 'handleNewBooking'
  | 'planAlert'
  | 'state'
> & {
  mode: BookingWizardMode;
  isOffline: boolean;
  initialCalendarMask?: CalendarMask | null;
  contactLocks?: AuthenticatedContactLocks;
  onTrack: AnalyticsTracker['track'];
};

export function BookingWizardStepContent({
  state,
  mode,
  isOffline,
  initialCalendarMask,
  contactLocks,
  onTrack,
  handleActionsChange,
  handleConfirm,
  handleNewBooking,
  handleClose,
  planAlert,
}: BookingWizardStepContentProps) {
  if (state.loading && state.step !== 4) {
    switch (state.step) {
      case 1:
        return <PlanStepSkeleton />;
      case 2:
        return <DetailsStepSkeleton />;
      case 3:
        return <ReviewStepSkeleton />;
    }
  }

  switch (state.step) {
    case 1:
      return (
        <Suspense fallback={<PlanStepSkeleton />}>
          <PlanStep
            onActionsChange={handleActionsChange}
            onTrack={onTrack}
            planAlert={
              planAlert ?? (isOffline ? 'Reconnect to confirm; edits are saved locally.' : null)
            }
            initialCalendarMask={initialCalendarMask}
          />
        </Suspense>
      );
    case 2:
      return (
        <Suspense fallback={<DetailsStepSkeleton />}>
          <DetailsStep
            onActionsChange={handleActionsChange}
            contactLocks={contactLocks}
            mode={mode}
          />
        </Suspense>
      );
    case 3:
      return (
        <Suspense fallback={<ReviewStepSkeleton />}>
          <ReviewStep mode={mode} onConfirm={handleConfirm} onActionsChange={handleActionsChange} />
        </Suspense>
      );
    case 4:
      return (
        <ConfirmationStep
          mode={mode}
          onNewBooking={handleNewBooking}
          onClose={handleClose}
          onActionsChange={handleActionsChange}
        />
      );
  }
}

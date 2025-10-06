'use client';

import { Loader2 } from 'lucide-react';
import React, { Suspense } from 'react';

import { useWizardDependencies } from '../di';
import { useReservationWizard } from '../hooks/useReservationWizard';
import { ConfirmationStep } from './steps/ConfirmationStep';
import { DetailsStep } from './steps/DetailsStep';
import { PlanStep } from './steps/PlanStep';
import { ReviewStep } from './steps/ReviewStep';
import { WizardFooter } from './WizardFooter';
import { WizardLayout } from './WizardLayout';
import { WizardStickyConfirmation } from './WizardStickyConfirmation';

import type { BookingDetails } from '../model/reducer';

function LoadingFallback() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-12">
      <div className="space-y-3 text-center text-slate-600">
        <Loader2 className="mx-auto h-8 w-8 animate-spin" aria-hidden />
        <p className="text-base" role="status">
          Loading reservation flow…
        </p>
      </div>
    </main>
  );
}

type BookingWizardContentProps = {
  initialDetails?: Partial<BookingDetails>;
};

function BookingWizardContent({ initialDetails }: BookingWizardContentProps) {
  const {
    state,
    actions,
    heroRef,
    stepsMeta,
    stickyVisible,
    stickyActions,
    stickyHeight,
    handleStickyHeightChange,
    handleActionsChange,
    selectionSummary,
    handleConfirm,
    handleNewBooking,
    handleClose,
  } = useReservationWizard(initialDetails);
  const { analytics } = useWizardDependencies();

  const findAction = (id: string) => stickyActions.find((action) => action.id === id);

  const footer =
    state.step === 4 ? (
      <WizardStickyConfirmation
        steps={stepsMeta}
        currentStep={state.step}
        summary={selectionSummary}
        visible={stickyVisible}
        onClose={findAction('confirmation-close')?.onClick}
        onAddToCalendar={findAction('confirmation-calendar')?.onClick}
        onAddToWallet={findAction('confirmation-wallet')?.onClick}
        onStartNew={findAction('confirmation-new')?.onClick}
        closeDisabled={findAction('confirmation-close')?.disabled}
        calendarDisabled={findAction('confirmation-calendar')?.disabled}
        walletDisabled={findAction('confirmation-wallet')?.disabled}
        startNewDisabled={findAction('confirmation-new')?.disabled}
        calendarLoading={findAction('confirmation-calendar')?.loading}
        walletLoading={findAction('confirmation-wallet')?.loading}
      />
    ) : (
      <WizardFooter
        steps={stepsMeta}
        currentStep={state.step}
        summary={selectionSummary}
        actions={stickyActions}
        visible={stickyVisible}
        onHeightChange={handleStickyHeightChange}
      />
    );

  return (
    <WizardLayout
      heroRef={heroRef}
      stickyHeight={stickyHeight}
      stickyVisible={stickyVisible}
      footer={footer}
    >
      {(() => {
        switch (state.step) {
          case 1:
            return (
              <PlanStep
                state={state}
                actions={actions}
                onActionsChange={handleActionsChange}
                onTrack={analytics.track}
              />
            );
          case 2:
            return (
              <DetailsStep state={state} actions={actions} onActionsChange={handleActionsChange} />
            );
          case 3:
            return (
              <ReviewStep
                state={state}
                actions={actions}
                onConfirm={handleConfirm}
                onActionsChange={handleActionsChange}
              />
            );
          case 4:
            return (
              <ConfirmationStep
                state={state}
                onNewBooking={handleNewBooking}
                onClose={handleClose}
                onActionsChange={handleActionsChange}
              />
            );
          default:
            return null;
        }
      })()}
    </WizardLayout>
  );
}

type BookingWizardProps = {
  initialDetails?: Partial<BookingDetails>;
};

export function BookingWizard({ initialDetails }: BookingWizardProps = {}) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BookingWizardContent initialDetails={initialDetails} />
    </Suspense>
  );
}

export default BookingWizard;

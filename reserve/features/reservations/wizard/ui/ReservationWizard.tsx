'use client';

import { Loader2 } from 'lucide-react';
import React, { Suspense } from 'react';

import { useReservationWizard } from '../hooks/useReservationWizard';
import { ConfirmationStep } from './steps/ConfirmationStep';
import { DetailsStep } from './steps/DetailsStep';
import { PlanStep } from './steps/PlanStep';
import { ReviewStep } from './steps/ReviewStep';
import { WizardFooter } from './WizardFooter';
import { WizardLayout } from './WizardLayout';

function ReservationWizardContent() {
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
  } = useReservationWizard();

  return (
    <WizardLayout
      heroRef={heroRef}
      stickyHeight={stickyHeight}
      stickyVisible={stickyVisible}
      footer={
        <WizardFooter
          steps={stepsMeta}
          currentStep={state.step}
          summary={selectionSummary}
          actions={stickyActions}
          visible={stickyVisible}
          onHeightChange={handleStickyHeightChange}
        />
      }
    >
      {(() => {
        switch (state.step) {
          case 1:
            return (
              <PlanStep state={state} actions={actions} onActionsChange={handleActionsChange} />
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

export function ReservationWizard() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-12">
          <div className="space-y-3 text-center text-slate-600">
            <Loader2 className="mx-auto h-8 w-8 animate-spin" aria-hidden />
            <p className="text-base" role="status">
              Loading reservation flow…
            </p>
          </div>
        </main>
      }
    >
      <ReservationWizardContent />
    </Suspense>
  );
}

export default ReservationWizard;

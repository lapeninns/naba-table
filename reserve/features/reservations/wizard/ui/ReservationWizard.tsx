'use client';

import React, { Suspense } from 'react';

import { Icon } from '@reserve/shared/ui/icons';
import { bookingHelpers } from '@reserve/shared/utils/booking';

import { StickyProgress } from './StickyProgress';
import { useReservationWizard } from '../hooks/useReservationWizard';
import { ConfirmationStep } from './steps/ConfirmationStep';
import { DetailsStep } from './steps/DetailsStep';
import { PlanStep } from './steps/PlanStep';
import { ReviewStep } from './steps/ReviewStep';

function ReservationWizardContent() {
  const {
    state,
    dispatch,
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

  const mainStyle = stickyVisible
    ? {
        paddingBottom: `calc(${stickyHeight}px + env(safe-area-inset-bottom, 0px) + 1.5rem)`,
      }
    : undefined;

  return (
    <>
      <main
        style={mainStyle}
        className={bookingHelpers.cn(
          'min-h-screen w-full bg-slate-50 px-4 pb-24 pt-10 font-sans text-srx-ink-strong transition-[padding-bottom] sm:pt-16 md:px-8 lg:px-12',
        )}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 sm:gap-12 md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
          <span ref={heroRef} aria-hidden className="block h-px w-full" />
          {(() => {
            switch (state.step) {
              case 1:
                return (
                  <PlanStep
                    state={state}
                    dispatch={dispatch}
                    onActionsChange={handleActionsChange}
                  />
                );
              case 2:
                return (
                  <DetailsStep
                    state={state}
                    dispatch={dispatch}
                    onActionsChange={handleActionsChange}
                  />
                );
              case 3:
                return (
                  <ReviewStep
                    state={state}
                    dispatch={dispatch}
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
        </div>
      </main>
      <StickyProgress
        steps={stepsMeta}
        currentStep={state.step}
        summary={selectionSummary}
        visible={stickyVisible}
        actions={stickyActions}
        onHeightChange={handleStickyHeightChange}
      />
    </>
  );
}

export function ReservationWizard() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-12">
          <div className="space-y-3 text-center text-slate-600">
            <Icon.Spinner className="mx-auto h-8 w-8 animate-spin" />
            <p>Loading reservation flow…</p>
          </div>
        </main>
      }
    >
      <ReservationWizardContent />
    </Suspense>
  );
}

export default ReservationWizard;

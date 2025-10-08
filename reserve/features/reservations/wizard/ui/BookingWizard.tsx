'use client';

import { Loader2 } from 'lucide-react';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { emit } from '@/lib/analytics/emit';

import { useWizardDependencies } from '../di';
import { useReservationWizard } from '../hooks/useReservationWizard';
import { ConfirmationStep } from './steps/ConfirmationStep';
import { DetailsStep } from './steps/DetailsStep';
import { PlanStep } from './steps/PlanStep';
import { ReviewStep } from './steps/ReviewStep';
import { WizardFooter } from './WizardFooter';
import { WizardLayout } from './WizardLayout';
import { WizardOfflineBanner } from './WizardOfflineBanner';
import {
  ConfirmationStepSkeleton,
  DetailsStepSkeleton,
  PlanStepSkeleton,
  ReviewStepSkeleton,
} from './WizardSkeletons';
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

  const isOnline = useOnlineStatus();
  const isOffline = !isOnline;
  const offlineBannerRef = useRef<HTMLDivElement | null>(null);
  const lastOnlineAtRef = useRef<number>(Date.now());
  const offlineTrackedRef = useRef(false);
  const wasOfflineRef = useRef(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (isOnline) {
      lastOnlineAtRef.current = Date.now();
      offlineTrackedRef.current = false;
      return;
    }

    if (offlineTrackedRef.current) {
      return;
    }

    const wasOnlineForMs = Date.now() - lastOnlineAtRef.current;
    const payload = {
      path: window.location?.pathname ?? '/reserve',
      step: state.step,
      wasOnlineForMs: Number.isFinite(wasOnlineForMs) ? wasOnlineForMs : undefined,
    };

    analytics.track('wizard_offline_detected', payload);
    emit('wizard_offline_detected', payload);
    offlineTrackedRef.current = true;
  }, [analytics, isOnline, state.step]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (isOffline && !wasOfflineRef.current) {
      setTimeout(() => {
        offlineBannerRef.current?.focus();
      }, 0);
    }
    wasOfflineRef.current = isOffline;
  }, [hasHydrated, isOffline]);

  const disableAllActions = isOffline || state.loading;

  const effectiveActions = useMemo(() => {
    if (!disableAllActions) {
      return stickyActions;
    }

    return stickyActions.map((action) => ({
      ...action,
      disabled: true,
    }));
  }, [disableAllActions, stickyActions]);

  const findAction = (id: string) => effectiveActions.find((action) => action.id === id);

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
        actions={effectiveActions}
        visible={stickyVisible}
        onHeightChange={handleStickyHeightChange}
      />
    );

  const banner =
    hasHydrated && isOffline ? (
      <WizardOfflineBanner
        ref={offlineBannerRef}
        description="Reconnecting will re-enable confirmation and sharing actions."
      />
    ) : null;

  const stepContent = (() => {
    if (state.loading) {
      switch (state.step) {
        case 1:
          return <PlanStepSkeleton />;
        case 2:
          return <DetailsStepSkeleton />;
        case 3:
          return <ReviewStepSkeleton />;
        case 4:
          return <ConfirmationStepSkeleton />;
        default:
          return null;
      }
    }

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
  })();

  return (
    <WizardLayout
      heroRef={heroRef}
      stickyHeight={stickyHeight}
      stickyVisible={stickyVisible}
      banner={banner}
      footer={footer}
    >
      {stepContent}
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

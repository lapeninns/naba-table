'use client';

import { Loader2 } from 'lucide-react';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useProfile } from '@/hooks/useProfile';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
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

import type { BookingDetails, BookingWizardMode } from '../model/reducer';

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
  mode?: BookingWizardMode;
  layoutElement?: 'main' | 'div';
};

function BookingWizardContent({
  initialDetails,
  mode = 'customer',
  layoutElement = 'main',
}: BookingWizardContentProps) {
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
    planAlert,
  } = useReservationWizard(initialDetails, mode);
  const { analytics } = useWizardDependencies();
  const { user, status: sessionStatus } = useSupabaseSession();
  const isSessionReady = sessionStatus === 'ready';
  const isAuthenticated = isSessionReady && Boolean(user);
  const shouldLockContacts = isAuthenticated && mode !== 'ops';
  const { data: profile } = useProfile({ enabled: shouldLockContacts });

  const fallbackName =
    (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    (typeof user?.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
    '';
  const lockedName = shouldLockContacts ? (profile?.name ?? fallbackName ?? '').trim() : '';
  const lockedEmail = shouldLockContacts ? (profile?.email ?? user?.email ?? '').trim() : '';
  const lockedPhone = shouldLockContacts ? (profile?.phone ?? '').trim() : '';

  useEffect(() => {
    if (!shouldLockContacts) {
      return;
    }

    if (lockedEmail && state.details.email.trim() !== lockedEmail) {
      actions.updateDetails('email', lockedEmail);
    }

    if (lockedName && state.details.name.trim() !== lockedName) {
      actions.updateDetails('name', lockedName);
    }

    if (lockedPhone && state.details.phone.trim() !== lockedPhone) {
      actions.updateDetails('phone', lockedPhone);
    }
  }, [
    actions,
    shouldLockContacts,
    lockedEmail,
    lockedName,
    lockedPhone,
    state.details.email,
    state.details.name,
    state.details.phone,
  ]);

  const contactLocks = useMemo(() => {
    if (!shouldLockContacts) {
      return undefined;
    }

    return {
      name: Boolean(lockedName),
      email: true,
      phone: Boolean(lockedPhone),
    } as const;
  }, [lockedName, lockedPhone, shouldLockContacts]);

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
            planAlert={planAlert}
          />
        );
      case 2:
        return (
          <DetailsStep
            state={state}
            actions={actions}
            onActionsChange={handleActionsChange}
            contactLocks={contactLocks}
            mode={mode}
          />
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
      elementType={layoutElement}
    >
      {stepContent}
    </WizardLayout>
  );
}

type BookingWizardProps = {
  initialDetails?: Partial<BookingDetails>;
  mode?: BookingWizardMode;
  layoutElement?: 'main' | 'div';
};

export function BookingWizard({
  initialDetails,
  mode = 'customer',
  layoutElement = 'main',
}: BookingWizardProps = {}) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BookingWizardContent
        initialDetails={initialDetails}
        mode={mode}
        layoutElement={layoutElement}
      />
    </Suspense>
  );
}

export default BookingWizard;

'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useProfile } from '@/hooks/useProfile';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { emit } from '@/lib/analytics/emit';

import { WizardProvider } from '../context/WizardContext';
import { useWizardDependencies } from '../di';
import { useReservationWizard } from '../hooks/useReservationWizard';
import { ConfirmationStep } from './steps/ConfirmationStep';
import { WizardContainer } from './WizardContainer';
import { WizardOfflineBanner } from './WizardOfflineBanner';
import {
  BookingWizardShellSkeleton,
  DetailsStepSkeleton,
  PlanStepSkeleton,
  ReviewStepSkeleton,
} from './WizardSkeletons';
const PlanStep = React.lazy(() =>
  import('./steps/PlanStep').then((m) => ({ default: m.PlanStep })),
);
const DetailsStep = React.lazy(() =>
  import('./steps/DetailsStep').then((m) => ({ default: m.DetailsStep })),
);
const ReviewStep = React.lazy(() =>
  import('./steps/ReviewStep').then((m) => ({ default: m.ReviewStep })),
);

import type { WizardLayoutSurface } from './WizardLayout';
import type { BookingDetails, BookingWizardMode } from '../model/reducer';
import type { CalendarMask } from '@reserve/features/reservations/wizard/services/schedule';

function LoadingFallback({
  layoutElement = 'main',
  layoutSurface = 'guest',
}: {
  layoutElement?: 'main' | 'div';
  layoutSurface?: WizardLayoutSurface;
}) {
  return <BookingWizardShellSkeleton layoutElement={layoutElement} layoutSurface={layoutSurface} />;
}

type BookingWizardContentProps = {
  initialDetails?: Partial<BookingDetails>;
  mode?: BookingWizardMode;
  layoutElement?: 'main' | 'div';
  layoutSurface?: WizardLayoutSurface;
  initialCalendarMask?: CalendarMask | null;
  returnPath?: string;
  redirectOnSuccess?: boolean;
  navigationClassName?: string;
  className?: string;
  contentClassName?: string;
};

function BookingWizardContent({
  initialDetails,
  mode = 'customer',
  layoutElement = 'main',
  layoutSurface = 'guest',
  initialCalendarMask,
  returnPath,
  redirectOnSuccess,
  navigationClassName,
  className,
  contentClassName,
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
  } = useReservationWizard(initialDetails, mode, { returnPath, redirectOnSuccess });
  const { analytics } = useWizardDependencies();
  const { user, status: sessionStatus } = useSupabaseSession();
  const isAuthenticated = sessionStatus === 'authenticated' && Boolean(user);
  const shouldLockContacts = isAuthenticated && mode !== 'ops';
  const { data: profile } = useProfile({ enabled: shouldLockContacts });

  const fallbackName =
    (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    (typeof user?.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
    '';
  const lockedName = shouldLockContacts ? (profile?.name ?? fallbackName ?? '').trim() : '';
  const lockedEmail = shouldLockContacts ? (profile?.email ?? user?.email ?? '').trim() : '';
  const lockedPhone = shouldLockContacts ? (profile?.phone ?? '').trim() : '';
  const authenticatedHydrationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    void import('./steps/DetailsStep');
    void import('./steps/ReviewStep');
  }, []);

  useEffect(() => {
    if (!shouldLockContacts) {
      authenticatedHydrationKeyRef.current = null;
      return;
    }

    const hydrationKey = [user?.id ?? '', lockedName, lockedEmail, lockedPhone].join('\u0000');
    if (authenticatedHydrationKeyRef.current === hydrationKey) {
      return;
    }

    authenticatedHydrationKeyRef.current = hydrationKey;
    actions.hydrateContacts({
      name: lockedName,
      email: lockedEmail,
      phone: lockedPhone,
      source: 'authenticated',
    });
  }, [actions, shouldLockContacts, lockedEmail, lockedName, lockedPhone, user?.id]);

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
      const focusTimer = setTimeout(() => {
        offlineBannerRef.current?.focus();
      }, 0);
      wasOfflineRef.current = isOffline;
      return () => clearTimeout(focusTimer);
    }
    wasOfflineRef.current = isOffline;
  }, [hasHydrated, isOffline]);

  const shouldDisablePrimaryActions = isOffline || (state.loading && state.step !== 4);

  const effectiveActions = useMemo(() => {
    return stickyActions.map((action) => {
      const disableForState =
        shouldDisablePrimaryActions && (action.role ?? 'primary') === 'primary';
      return {
        ...action,
        disabled: action.disabled || disableForState,
      };
    });
  }, [shouldDisablePrimaryActions, stickyActions]);

  const banner =
    hasHydrated && isOffline ? (
      <WizardOfflineBanner
        ref={offlineBannerRef}
        description="You’re offline. You can edit details, but confirming requires a connection."
      />
    ) : null;
  const effectiveStickyVisible = state.step === 4 ? true : stickyVisible;

  const shouldShowSkeleton = state.loading && state.step !== 4;

  const stepContent = (() => {
    if (shouldShowSkeleton) {
      switch (state.step) {
        case 1:
          return <PlanStepSkeleton />;
        case 2:
          return <DetailsStepSkeleton />;
        case 3:
          return <ReviewStepSkeleton />;
        default:
          return null;
      }
    }

    switch (state.step) {
      case 1:
        return (
          <Suspense fallback={<PlanStepSkeleton />}>
            <PlanStep
              onActionsChange={handleActionsChange}
              onTrack={analytics.track}
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
            <ReviewStep
              mode={mode}
              onConfirm={handleConfirm}
              onActionsChange={handleActionsChange}
            />
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
      default:
        return null;
    }
  })();

  return (
    <WizardProvider state={state} actions={actions}>
      <WizardContainer
        steps={stepsMeta}
        currentStep={state.step}
        actions={effectiveActions}
        summary={selectionSummary}
        heroRef={heroRef}
        stickyHeight={stickyHeight}
        stickyVisible={effectiveStickyVisible}
        onStickyHeightChange={handleStickyHeightChange}
        restaurantName={state.details.restaurantName || undefined}
        banner={banner}
        layoutElement={layoutElement}
        layoutSurface={layoutSurface}
        navigationClassName={navigationClassName}
        className={className}
        contentClassName={contentClassName}
        onStepSelect={state.step < 4 ? actions.goToStep : undefined}
      >
        {stepContent}
      </WizardContainer>
    </WizardProvider>
  );
}

type BookingWizardProps = {
  initialDetails?: Partial<BookingDetails>;
  mode?: BookingWizardMode;
  layoutElement?: 'main' | 'div';
  layoutSurface?: WizardLayoutSurface;
  initialCalendarMask?: CalendarMask | null;
  returnPath?: string;
  redirectOnSuccess?: boolean;
  navigationClassName?: string;
  className?: string;
  contentClassName?: string;
};

export function BookingWizard({
  initialDetails,
  mode = 'customer',
  layoutElement = 'main',
  layoutSurface = 'guest',
  initialCalendarMask,
  returnPath,
  redirectOnSuccess,
  navigationClassName,
  className,
  contentClassName,
}: BookingWizardProps = {}) {
  return (
    <Suspense
      fallback={<LoadingFallback layoutElement={layoutElement} layoutSurface={layoutSurface} />}
    >
      <BookingWizardContent
        initialDetails={initialDetails}
        mode={mode}
        layoutElement={layoutElement}
        layoutSurface={layoutSurface}
        initialCalendarMask={initialCalendarMask}
        returnPath={returnPath}
        redirectOnSuccess={redirectOnSuccess}
        navigationClassName={navigationClassName}
        className={className}
        contentClassName={contentClassName}
      />
    </Suspense>
  );
}

export default BookingWizard;

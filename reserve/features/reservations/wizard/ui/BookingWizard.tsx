'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { emit } from '@/lib/analytics/emit';

import { WizardProvider } from '../context/WizardContext';
import { useWizardDependencies } from '../di';
import { BookingWizardStepContent } from './BookingWizardStepContent';
import { WizardContainer } from './WizardContainer';
import { WizardOfflineBanner } from './WizardOfflineBanner';
import { BookingWizardShellSkeleton } from './WizardSkeletons';
import { useAuthenticatedContactLocks } from '../hooks/useAuthenticatedContactLocks';
import { useReservationWizard } from '../hooks/useReservationWizard';
import { createConfirmationSummary } from '../model/selectors';

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
  const contactLocks = useAuthenticatedContactLocks(actions, mode);

  useEffect(() => {
    void import('./steps/DetailsStep');
    void import('./steps/ReviewStep');
  }, []);

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

  // On the confirmation step, the summary sheet should surface the booking
  // reference + when/party, not the pre-booking Date/Time/Party/Service selection.
  const navSummary = useMemo(
    () =>
      state.step === 4 && state.lastConfirmed?.reference
        ? createConfirmationSummary(state.lastConfirmed.reference, state.details)
        : selectionSummary,
    [state.step, state.lastConfirmed?.reference, state.details, selectionSummary],
  );

  return (
    <WizardProvider state={state} actions={actions}>
      <WizardContainer
        steps={stepsMeta}
        currentStep={state.step}
        actions={effectiveActions}
        summary={navSummary}
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
        mode={mode}
      >
        <BookingWizardStepContent
          state={state}
          mode={mode}
          isOffline={isOffline}
          initialCalendarMask={initialCalendarMask}
          contactLocks={contactLocks}
          onTrack={analytics.track}
          handleActionsChange={handleActionsChange}
          handleConfirm={handleConfirm}
          handleNewBooking={handleNewBooking}
          handleClose={handleClose}
          planAlert={planAlert}
        />
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

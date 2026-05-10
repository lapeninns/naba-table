'use client';

import { useEffect } from 'react';

import { WizardProvider } from '@features/reservations/wizard/context/WizardContext';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import { useWizardStore } from '@features/reservations/wizard/model/store';
import { ReviewStep } from '@features/reservations/wizard/ui/steps/ReviewStep';

function GuestBookingErrorReviewHarness() {
  const { state, actions } = useWizardStore({
    restaurantId: 'rest-dev',
    restaurantSlug: 'old-crown-girton',
    restaurantName: 'The Old Crown Girton',
    restaurantAddress: '22 High Street, Girton',
    restaurantTimezone: 'Europe/London',
    date: '2026-04-22',
    time: '19:00',
    party: 4,
    bookingType: 'dinner',
    name: 'Guest Booker',
    email: 'guest@example.com',
    phone: '+447467586751',
    agree: true,
  });

  useEffect(() => {
    actions.goToStep(3);
    actions.setError(
      'We already have a booking with those details. Please check your confirmation email or call the restaurant if you need help.',
    );
  }, [actions]);

  return (
    <WizardProvider state={state} actions={actions}>
      <main className="min-h-screen bg-muted/20 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <ReviewStep onConfirm={() => {}} onActionsChange={() => {}} />
        </div>
      </main>
    </WizardProvider>
  );
}

export function GuestBookingErrorDevHarness() {
  return (
    <WizardDependenciesProvider>
      <GuestBookingErrorReviewHarness />
    </WizardDependenciesProvider>
  );
}

'use client';

import { useEffect } from 'react';

import { WizardProvider } from '@features/reservations/wizard/context/WizardContext';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import { useWizardStore } from '@features/reservations/wizard/model/store';
import { ReviewStep } from '@features/reservations/wizard/ui/steps/ReviewStep';

const DUPLICATE_BOOKING_MESSAGE =
  'We already have a booking with those details. Please check your confirmation email or call the restaurant if you need help.';

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
    actions.setError(DUPLICATE_BOOKING_MESSAGE);
  }, [actions]);

  return (
    <WizardProvider state={state} actions={actions}>
      <main className="min-h-screen bg-muted/20 px-4 py-10">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr),360px]">
          <div>
            <ReviewStep onConfirm={() => {}} onActionsChange={() => {}} />
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Mock Error Response
              </h2>
              <p className="mt-4 text-sm text-foreground">{DUPLICATE_BOOKING_MESSAGE}</p>
            </section>
          </aside>
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

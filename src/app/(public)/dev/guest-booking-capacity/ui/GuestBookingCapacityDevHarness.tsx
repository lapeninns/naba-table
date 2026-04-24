'use client';

import { useEffect } from 'react';

import { WizardProvider } from '@features/reservations/wizard/context/WizardContext';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import { useWizardStore } from '@features/reservations/wizard/model/store';
import { ReviewStep } from '@features/reservations/wizard/ui/steps/ReviewStep';

const MOCK_ALTERNATIVES = [
  { time: '18:30', utilizationPercent: 80 },
  { time: '20:00', utilizationPercent: 70 },
  { time: '20:30', utilizationPercent: 62 },
] as const;

const MOCK_TABLE_AVAILABILITY = [
  { table: 'T1', seats: 2, status: 'Held', note: 'Existing booking overlap 18:45–20:15' },
  { table: 'T2', seats: 2, status: 'Held', note: 'Existing booking overlap 19:00–20:30' },
  { table: 'T7', seats: 4, status: 'Unavailable', note: 'Combined table reserved for large party' },
  { table: 'T9', seats: 4, status: 'Available later', note: 'Next clean turn begins at 20:00' },
] as const;

function GuestBookingCapacityReviewHarness() {
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
      'No capacity available for 19:00. Try 18:30, 20:00, or 20:30 instead.',
    );
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
                Mock Capacity Response
              </h2>
              <dl className="mt-4 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Requested slot</dt>
                  <dd className="font-medium text-foreground">19:00 for 4 guests</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Service period</dt>
                  <dd className="font-medium text-foreground">Dinner</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Booked covers</dt>
                  <dd className="font-medium text-foreground">20 / 20</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Utilization</dt>
                  <dd className="font-medium text-foreground">100%</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Mock Alternatives
              </h2>
              <ul className="mt-4 space-y-3">
                {MOCK_ALTERNATIVES.map((slot) => (
                  <li
                    key={slot.time}
                    className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2"
                  >
                    <span className="text-sm font-medium text-foreground">{slot.time}</span>
                    <span className="text-xs text-muted-foreground">
                      {slot.utilizationPercent}% full
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Mock Table Availability
              </h2>
              <ul className="mt-4 space-y-3">
                {MOCK_TABLE_AVAILABILITY.map((table) => (
                  <li
                    key={table.table}
                    className="rounded-lg border border-border/70 bg-background px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">
                        {table.table} · {table.seats} seats
                      </span>
                      <span className="text-xs text-muted-foreground">{table.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{table.note}</p>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </WizardProvider>
  );
}

export function GuestBookingCapacityDevHarness() {
  return (
    <WizardDependenciesProvider>
      <GuestBookingCapacityReviewHarness />
    </WizardDependenciesProvider>
  );
}

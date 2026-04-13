'use client';

import { AlertCircle } from 'lucide-react';

import {
  derivePlanDateAdvisory,
} from '@features/reservations/wizard/hooks/usePlanStepForm';
import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';

const WEEKEND_DATE = '2026-04-18';
const OVERRIDE_DATE = '2026-04-15';

export function GuestBookingPlanAlertDevHarness() {
  const weekendAdvisory = derivePlanDateAdvisory(WEEKEND_DATE, []);
  const overrideAdvisory = derivePlanDateAdvisory(OVERRIDE_DATE, [OVERRIDE_DATE]);

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-foreground">Guest Booking Plan Alert</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dev-only proof for the plan-step advisory shown on weekends and date overrides.
          </p>
        </section>

        {weekendAdvisory ? (
          <section className="space-y-2 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Weekend selection
            </p>
            <p className="text-sm text-foreground">Selected date: {WEEKEND_DATE}</p>
            <Alert variant="info">
              <AlertIcon>
                <AlertCircle className="h-4 w-4" aria-hidden />
              </AlertIcon>
              <AlertDescription>{weekendAdvisory}</AlertDescription>
            </Alert>
          </section>
        ) : null}

        {overrideAdvisory ? (
          <section className="space-y-2 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Override selection
            </p>
            <p className="text-sm text-foreground">Selected date: {OVERRIDE_DATE}</p>
            <Alert variant="info">
              <AlertIcon>
                <AlertCircle className="h-4 w-4" aria-hidden />
              </AlertIcon>
              <AlertDescription>{overrideAdvisory}</AlertDescription>
            </Alert>
          </section>
        ) : null}
      </div>
    </main>
  );
}

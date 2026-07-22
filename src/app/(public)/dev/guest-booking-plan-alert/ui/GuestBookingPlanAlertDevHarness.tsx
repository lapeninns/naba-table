'use client';

import { AlertCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert';
import { Heading, Text } from '@/components/ui/typography';
import { derivePlanDateAdvisory } from '@features/reservations/wizard/hooks/usePlanStepForm';

const WEEKEND_DATE = '2026-04-18';
const OVERRIDE_DATE = '2026-04-15';
const NOTE_DATE = '2026-04-14';
const OPERATING_HOURS_NOTE = 'Kitchen closes early at 8:30 PM due to a private event.';

export function GuestBookingPlanAlertDevHarness() {
  const noteAdvisory = derivePlanDateAdvisory(NOTE_DATE, [], OPERATING_HOURS_NOTE);
  const weekendAdvisory = derivePlanDateAdvisory(WEEKEND_DATE, []);
  const overrideAdvisory = derivePlanDateAdvisory(OVERRIDE_DATE, [OVERRIDE_DATE]);

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Heading variant="section" as="h1">Guest Booking Plan Alert</Heading>
          <Text variant="caption" className="mt-2">
            Dev-only proof for the plan-step advisory shown on weekends and date overrides.
          </Text>
        </section>

        {noteAdvisory ? (
          <section className="space-y-2 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <Text variant="eyebrow">Operating-hours note</Text>
            <Text variant="caption" className="text-foreground">Selected date: {NOTE_DATE}</Text>
            <Alert variant="info">
              <AlertIcon>
                <AlertCircle className="h-4 w-4" aria-hidden />
              </AlertIcon>
              <AlertDescription>{noteAdvisory}</AlertDescription>
            </Alert>
          </section>
        ) : null}

        {weekendAdvisory ? (
          <section className="space-y-2 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <Text variant="eyebrow">Weekend selection</Text>
            <Text variant="caption" className="text-foreground">Selected date: {WEEKEND_DATE}</Text>
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
            <Text variant="eyebrow">Override selection</Text>
            <Text variant="caption" className="text-foreground">Selected date: {OVERRIDE_DATE}</Text>
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

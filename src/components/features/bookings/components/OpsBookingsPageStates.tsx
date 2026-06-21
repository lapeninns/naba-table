'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Button } from '@/components/ui/button';
import { useBookingStateMachine } from '@/contexts/booking-state-machine';
import { opsHref } from '@/lib/url/opsHref';

import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsBookingStatus } from '@/types/ops';

export function BookingStateRegistrar({ bookings }: { bookings: BookingDTO[] }) {
  const { registerBookings } = useBookingStateMachine();

  useEffect(() => {
    registerBookings(
      bookings.map((booking) => ({
        id: booking.id,
        status: booking.status as OpsBookingStatus,
        updatedAt: null,
      })),
    );
  }, [bookings, registerBookings]);

  return null;
}

export function NoRestaurantAccess() {
  return (
    <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
      <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
        <OpsEmptyState
          title="No restaurant access yet"
          description="Ask an owner or manager to send you an invitation so you can manage bookings."
          action={
            <Button asChild variant="secondary">
              <Link href={opsHref('/dashboard')}>Return to ops home</Link>
            </Button>
          }
        />
      </section>
    </OpsPageShell>
  );
}

export function SelectingRestaurantFallback() {
  return (
    <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
      <section className="mx-auto flex min-h-[40vh] max-w-2xl items-center justify-center">
        <OpsEmptyState
          title="Loading restaurant access…"
          description="We’re preparing your bookings. This will only take a moment."
        />
      </section>
    </OpsPageShell>
  );
}

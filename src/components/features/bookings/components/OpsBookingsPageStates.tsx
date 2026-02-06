'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Button } from '@/components/ui/button';
import { useBookingStateMachine } from '@/contexts/booking-state-machine';

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
    <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center p-8">
      <OpsEmptyState
        title="No restaurant access yet"
        description="Ask an owner or manager to send you an invitation so you can manage bookings."
        action={
          <Button asChild variant="secondary">
            <Link href="/guest/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </section>
  );
}

export function SelectingRestaurantFallback() {
  return (
    <section className="mx-auto flex min-h-[40vh] max-w-2xl items-center justify-center p-8">
      <OpsEmptyState
        title="Loading restaurant access…"
        description="We’re preparing your bookings. This will only take a moment."
      />
    </section>
  );
}


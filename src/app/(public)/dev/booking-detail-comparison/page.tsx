import Link from 'next/link';

import ReservationDetailClient from '@/components/features/booking/detail/ReservationDetailClient';
import { env } from '@/lib/env';
import { createSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';
import {
  getBookingLifecycleFixture,
  getDefaultBookingLifecycleFixture,
} from '@/src/app/(public)/dev/_mocks/bookingLifecycleFixtures';
import { enforceDevOnly } from '@/src/app/(public)/dev/_shared/enforceDevOnly';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

export const dynamic = 'force-dynamic';

export default async function DevBookingDetailComparisonPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  enforceDevOnly();

  const params = await searchParams;
  const fixture = getBookingLifecycleFixture(firstValue(params.fixture)) ?? getDefaultBookingLifecycleFixture();
  const reservation = fixture.reservation;
  const secret = env.security.sessionRecoveryAccessTokenSecret?.trim() ?? null;
  const accessToken = secret
    ? createSessionRecoveryAccessToken({
        restaurantId: reservation.restaurantId,
        email: reservation.customerEmail,
        phone: reservation.customerPhone,
        secret,
      })
    : null;
  const publicReturnPath = accessToken
    ? `/bookings/recover?access_token=${encodeURIComponent(accessToken)}&next=${encodeURIComponent(`/bookings/${reservation.id}`)}`
    : `/bookings/recover?next=${encodeURIComponent(`/bookings/${reservation.id}`)}`;
  const guestReturnPath = accessToken
    ? `/bookings/recover?access_token=${encodeURIComponent(accessToken)}&next=${encodeURIComponent(`/guest/bookings/${reservation.id}`)}`
    : `/bookings/recover?next=${encodeURIComponent(`/guest/bookings/${reservation.id}`)}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          Dev-only booking detail comparison harness
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Public and guest booking detail comparison
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          This mocked authenticated harness renders the shared booking-detail model side by side for
          the canonical public booking route and the guest booking-detail route without mutating shared
          auth state.
        </p>
      </header>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="rounded-full border border-border px-4 py-2 hover:bg-accent" href="/dev/booking-detail-comparison?fixture=active">
          Active fixture
        </Link>
        <Link className="rounded-full border border-border px-4 py-2 hover:bg-accent" href="/dev/booking-detail-comparison?fixture=pending">
          Pending fixture
        </Link>
        <Link className="rounded-full border border-border px-4 py-2 hover:bg-accent" href="/dev/booking-detail-comparison?fixture=cancelled">
          Cancelled fixture
        </Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Public booking detail fixture</h2>
            <p className="text-sm text-muted-foreground">
              Mirrors the entitled public booking detail success state.
            </p>
          </div>
          <ReservationDetailClient
            reservationId={reservation.id}
            restaurantName={reservation.restaurantName ?? null}
            initialNow={Date.parse('2026-02-10T12:00:00.000Z')}
            canManage
            signInReturnPath={publicReturnPath}
          />
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Guest booking detail fixture</h2>
            <p className="text-sm text-muted-foreground">
              Mirrors the mocked authenticated guest booking-detail surface for the same fixture.
            </p>
          </div>
          <ReservationDetailClient
            reservationId={reservation.id}
            restaurantName={reservation.restaurantName ?? null}
            initialNow={Date.parse('2026-02-10T12:00:00.000Z')}
            canManage
            signInReturnPath={guestReturnPath}
          />
        </div>
      </section>
    </main>
  );
}

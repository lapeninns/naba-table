import 'server-only';

import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import Link from 'next/link';

import ReservationDetailClient from '@/components/features/booking/detail/ReservationDetailClient';
import { env } from '@/lib/env';
import { createSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';
import {
  getBookingLifecycleFixture,
  getDefaultBookingLifecycleFixture,
} from '@/src/app/(public)/dev/_mocks/bookingLifecycleFixtures';
import { enforceDevOnly } from '@/src/app/(public)/dev/_shared/enforceDevOnly';
import { reservationAdapter } from '@entities/reservation/adapter';
import { reservationKeys } from '@shared/api/queryKeys';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

export const dynamic = 'force-dynamic';

function buildFixtureBookingPayload(reservation: ReturnType<typeof getDefaultBookingLifecycleFixture>['reservation']) {
  return {
    id: reservation.id,
    restaurant_id: reservation.restaurantId,
    booking_date: reservation.bookingDate,
    start_time: reservation.startTime,
    end_time: reservation.endTime ?? null,
    start_at: reservation.startAt,
    end_at: reservation.endAt ?? reservation.startAt,
    booking_type: reservation.bookingType ?? null,
    seating_preference: reservation.seatingPreference ?? null,
    status: reservation.status,
    party_size: reservation.partySize,
    customer_name: reservation.customerName,
    customer_email: reservation.customerEmail,
    customer_phone: reservation.customerPhone,
    marketing_opt_in: reservation.marketingOptIn ?? false,
    notes: reservation.notes ?? null,
    reference: reservation.reference ?? null,
    restaurants: {
      name: reservation.restaurantName ?? null,
      slug: reservation.restaurantSlug ?? null,
      timezone: reservation.restaurantTimezone ?? null,
    },
  };
}

function buildRecoveryHref(accessToken: string | null, nextPath: string) {
  const encodedNext = encodeURIComponent(nextPath);
  if (!accessToken) {
    return `/bookings/recover?next=${encodedNext}`;
  }

  return `/bookings/recover?access_token=${encodeURIComponent(accessToken)}&next=${encodedNext}`;
}

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
  const publicNextPath = `/bookings/${reservation.id}`;
  const guestNextPath = `/guest/bookings/${reservation.id}`;
  const publicReturnPath = buildRecoveryHref(accessToken, publicNextPath);
  const guestReturnPath = buildRecoveryHref(accessToken, guestNextPath);
  const queryClient = new QueryClient();
  queryClient.setQueryData(
    reservationKeys.detail(reservation.id),
    reservationAdapter(buildFixtureBookingPayload(reservation)),
  );
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
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

        <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm lg:grid-cols-2">
          <RecoveryLinkCard
            title="Public recovery URL"
            description="Replay the live public-booking recovery path with the current-runtime token, then confirm it settles on the token-free public booking URL."
            recoveryHref={publicReturnPath}
            finalDestination={publicNextPath}
            accessToken={accessToken}
          />
          <RecoveryLinkCard
            title="Guest recovery URL"
            description="Replay the guest-panel continuity path with the same current-runtime token while preserving the distinct guest destination."
            recoveryHref={guestReturnPath}
            finalDestination={guestNextPath}
            accessToken={accessToken}
          />
        </section>

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
    </HydrationBoundary>
  );
}

function RecoveryLinkCard({
  title,
  description,
  recoveryHref,
  finalDestination,
  accessToken,
}: {
  title: string;
  description: string;
  recoveryHref: string;
  finalDestination: string;
  accessToken: string | null;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-background p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3 text-sm">
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Final destination</p>
          <p className="mt-2 break-all font-medium text-foreground">{finalDestination}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recovery URL</p>
          <p className="mt-2 break-all font-medium text-foreground">{recoveryHref}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {accessToken
            ? 'This dev-only recovery URL includes the real current-runtime access token so validators can replay the exact flow without inventing or substituting token values.'
            : 'Recovery token generation is unavailable because SESSION_RECOVERY_ACCESS_TOKEN_SECRET is missing in the current runtime.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90" href={recoveryHref}>
          Open recovery URL
        </Link>
        <Link className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent" href={`/auth/signin?redirectedFrom=${encodeURIComponent(recoveryHref)}`}>
          Open sign-in handoff
        </Link>
      </div>
    </section>
  );
}

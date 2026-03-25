import Link from 'next/link';

import { env } from '@/lib/env';
import { createSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';
import {
  getBookingLifecycleFixture,
  getDefaultBookingLifecycleFixture,
} from '@/src/app/(public)/dev/_mocks/bookingLifecycleFixtures';
import { enforceDevOnly } from '@/src/app/(public)/dev/_shared/enforceDevOnly';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

const DEFAULTS = {
  restaurantId: '11111111-1111-4111-8111-111111111111',
  email: 'guest@example.com',
  phone: '+441234567890',
};

export default async function DevBookingRecoveryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  enforceDevOnly();

  const params = await searchParams;
  const fixture = getBookingLifecycleFixture(firstValue(params.fixture)) ?? getDefaultBookingLifecycleFixture();
  const bookingId = firstValue(params.bookingId) ?? fixture.reservation.id;
  const restaurantId = firstValue(params.restaurantId) ?? fixture.reservation.restaurantId ?? DEFAULTS.restaurantId;
  const email = firstValue(params.email) ?? fixture.reservation.customerEmail ?? DEFAULTS.email;
  const phone = firstValue(params.phone) ?? fixture.reservation.customerPhone ?? DEFAULTS.phone;
  const secret = env.security.sessionRecoveryAccessTokenSecret?.trim() ?? null;

  const accessToken = secret
    ? createSessionRecoveryAccessToken({
        restaurantId,
        email,
        phone,
        secret,
      })
    : null;

  const nextPath = `/bookings/${bookingId}`;
  const recoverHref = accessToken
    ? `/bookings/recover?access_token=${encodeURIComponent(accessToken)}&next=${encodeURIComponent(nextPath)}`
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          Dev-only booking recovery harness
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Tokenized booking recovery fixture
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          This local-only page generates a deterministic recovery link for live booking-detail
          validation. Use it to confirm recovery routes through <code>/bookings/recover</code>,
          sets the continuation cookie, and lands on the canonical booking detail URL without
          leaking the token.
        </p>
      </header>

      <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm md:grid-cols-2">
        <FixtureField label="Fixture" value={fixture.label} />
        <FixtureField label="Booking ID" value={bookingId} />
        <FixtureField label="Restaurant ID" value={restaurantId} />
        <FixtureField label="Guest email" value={email} />
        <FixtureField label="Guest phone" value={phone} />
        <FixtureField label="Next destination" value={nextPath} />
        <FixtureField
          label="Recovery token status"
          value={accessToken ? 'Generated from configured secret' : 'Missing secret configuration'}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Validation actions</h2>
        <div className="mt-4 flex flex-col gap-3">
          {recoverHref ? (
            <>
              <Link
                className="w-fit rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                href={recoverHref}
              >
                Open recovery link
              </Link>
              <Link
                className="w-fit rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground hover:bg-accent"
                href={`${recoverHref}&fixture=${encodeURIComponent(firstValue(params.fixture) ?? 'active')}`}
              >
                Open recovery link with fixture
              </Link>
              <p className="break-all text-sm text-muted-foreground">{recoverHref}</p>
            </>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-destructive">
                This harness needs <code>SESSION_RECOVERY_ACCESS_TOKEN_SECRET</code> to mint the
                same recovery token used by the canonical <code>/bookings/recover</code> flow.
              </p>
              <p className="text-muted-foreground">
                The standard mission setup provisions that secret from the original checkout&apos;s
                <code>.env.local</code>. If you still see this message, rerun
                <code>.factory/init.sh</code> or add the secret to your local env before validating
                recovery.
              </p>
            </div>
          )}
          <Link
            className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
            href={`/bookings/recover/error?code=LEGACY_TOKEN_DEPRECATED`}
          >
            Open deprecated-link error state
          </Link>
        </div>
      </section>
    </main>
  );
}

function FixtureField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

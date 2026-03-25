import Link from 'next/link';

import { normalizeBookingsTab } from '@/guest/lib/validation';

import { createGuestPortalDehydratedState, type GuestPortalReadFixture } from '../_mocks/services/devGuestPortal';
import { enforceDevOnly } from '../_shared/enforceDevOnly';
import { GuestBookingsDevHarness } from './ui/GuestBookingsDevHarness';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ fixture?: string | string[]; tab?: string | string[] }>;

const FIXTURES: GuestPortalReadFixture[] = ['default', 'empty', 'error', 'loading'];

function firstValue(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function resolveFixture(raw?: string): GuestPortalReadFixture {
  return FIXTURES.includes(raw as GuestPortalReadFixture) ? (raw as GuestPortalReadFixture) : 'default';
}

export default async function DevGuestBookingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  enforceDevOnly();

  const resolved = await searchParams;
  const fixture = resolveFixture(firstValue(resolved.fixture));
  const tab = normalizeBookingsTab(firstValue(resolved.tab));

  return (
    <div className="bg-surface-canvas">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6">
          <div className="space-y-1">
            <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Dev-only guest portal
            </span>
            <h1 className="text-lg font-semibold text-foreground">Bookings harness</h1>
            <p className="text-sm text-muted-foreground">
              Validates tab normalization plus upcoming/past booking states with mocked portal data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {FIXTURES.map((option) => (
              <Link
                key={option}
                href={`/dev/guest-bookings?fixture=${option}&tab=${tab}`}
                className="rounded-full border border-border px-3 py-1.5 font-medium text-foreground hover:bg-accent"
              >
                {option}
              </Link>
            ))}
            <Link
              href={`/dev/guest-bookings?fixture=${fixture}&tab=upcoming`}
              className="rounded-full border border-border px-3 py-1.5 font-medium text-foreground hover:bg-accent"
            >
              tab=upcoming
            </Link>
            <Link
              href={`/dev/guest-bookings?fixture=${fixture}&tab=history`}
              className="rounded-full border border-border px-3 py-1.5 font-medium text-foreground hover:bg-accent"
            >
              tab=history
            </Link>
            <Link
              href="/dev/guest-dashboard"
              className="rounded-full border border-border px-3 py-1.5 font-medium text-foreground hover:bg-accent"
            >
              Dashboard harness
            </Link>
            <Link
              href="/dev/guest-profile"
              className="rounded-full border border-border px-3 py-1.5 font-medium text-foreground hover:bg-accent"
            >
              Profile harness
            </Link>
          </div>
        </div>
      </header>

      <GuestBookingsDevHarness
        fixture={fixture}
        dehydratedState={createGuestPortalDehydratedState(fixture)}
        initialTab={tab}
      />
    </div>
  );
}

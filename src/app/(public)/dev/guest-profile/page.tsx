import Link from 'next/link';

import {
  DEV_GUEST_PORTAL_PROFILE,
  createGuestPortalDehydratedState,
  type GuestPortalReadFixture,
  type GuestProfileMutationFixture,
} from '../_mocks/services/devGuestPortal';
import { enforceDevOnly } from '../_shared/enforceDevOnly';
import { GuestProfileDevHarness } from './ui/GuestProfileDevHarness';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  fixture?: string | string[];
  mutation?: string | string[];
}>;

const FIXTURES: GuestPortalReadFixture[] = ['default', 'empty', 'error', 'loading'];
const MUTATION_FIXTURES: GuestProfileMutationFixture[] = ['success', 'error'];

function firstValue(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function resolveFixture(raw?: string): GuestPortalReadFixture {
  return FIXTURES.includes(raw as GuestPortalReadFixture) ? (raw as GuestPortalReadFixture) : 'default';
}

function resolveMutationFixture(raw?: string): GuestProfileMutationFixture {
  return MUTATION_FIXTURES.includes(raw as GuestProfileMutationFixture)
    ? (raw as GuestProfileMutationFixture)
    : 'success';
}

export default async function DevGuestProfilePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  enforceDevOnly();

  const resolved = await searchParams;
  const fixture = resolveFixture(firstValue(resolved.fixture));
  const mutationFixture = resolveMutationFixture(firstValue(resolved.mutation));

  return (
    <div className="bg-surface-canvas">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6">
          <div className="space-y-1">
            <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Dev-only guest portal
            </span>
            <h1 className="text-lg font-semibold text-foreground">Profile harness</h1>
            <p className="text-sm text-muted-foreground">
              Validates profile shell consistency, inline validation, and deterministic save feedback.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {FIXTURES.map((option) => (
              <Link
                key={option}
                href={`/dev/guest-profile?fixture=${option}&mutation=${mutationFixture}`}
                className="rounded-full border border-border px-3 py-1.5 font-medium text-foreground hover:bg-accent"
              >
                {option}
              </Link>
            ))}
            {MUTATION_FIXTURES.map((option) => (
              <Link
                key={option}
                href={`/dev/guest-profile?fixture=${fixture}&mutation=${option}`}
                className="rounded-full border border-border px-3 py-1.5 font-medium text-foreground hover:bg-accent"
              >
                save={option}
              </Link>
            ))}
            <Link
              href="/dev/guest-dashboard"
              className="rounded-full border border-border px-3 py-1.5 font-medium text-foreground hover:bg-accent"
            >
              Dashboard harness
            </Link>
            <Link
              href="/dev/guest-bookings"
              className="rounded-full border border-border px-3 py-1.5 font-medium text-foreground hover:bg-accent"
            >
              Bookings harness
            </Link>
          </div>
        </div>
      </header>

      <GuestProfileDevHarness
        fixture={fixture}
        mutationFixture={mutationFixture}
        viewModel={{
          dehydratedState: createGuestPortalDehydratedState(fixture, DEV_GUEST_PORTAL_PROFILE),
          profile: fixture === 'default' ? DEV_GUEST_PORTAL_PROFILE : null,
        }}
      />
    </div>
  );
}

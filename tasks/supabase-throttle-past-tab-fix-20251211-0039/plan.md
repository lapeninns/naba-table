---
task: supabase-throttle-past-tab-fix
timestamp_utc: 2025-12-11T00:39:00Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Supabase Auth & Past Tab Fixes

## Objective

Reduce Supabase auth polling to avoid 429s and ensure the Past bookings tab renders data consistent with its counter.

## Success Criteria

- [ ] Auth state refresh happens at sane cadence without 429 errors during manual QA.
- [ ] Past tab shows the correct list whenever count increments (no empty state while count > 0).

## Architecture & Components

- `hooks/useSupabaseSession.tsx` remains the canonical source of auth state; we'll augment it with a tiny publish/subscribe store (new module) so non-React code can read the latest snapshot.
- `components/LayoutClient` → `CrispChat` and `components/ButtonSignin` will consume the shared session instead of calling Supabase directly.
- `lib/analytics/emit.ts` will prefer the session snapshot for identity; only if the snapshot is still `loading` will it fall back to a single `supabase.auth.getUser()` call.
- `BookingListClient` logic stays mostly as-is; verify that `past` derivation reacts to cache updates, and add a derived memo specifically for counts/collections to avoid stale references after optimistic cancellation.

## Data Flow & API Contracts

- Auth: `SupabaseSessionProvider` hydrates from server session (`getSession`). New store broadcasts `{user, status}` to any listener, ensuring only the provider touches Supabase auth endpoints.
- Analytics identity resolution: reads email from snapshot → `hashEmail` → events, removing redundant `/auth/v1/user` calls.
- Bookings cancellation: `useCancelBooking` already mutates TanStack cache; ensure `BookingListClient` memoization keys depend on cache revisions (e.g., include query result `items` reference) so “Past” tab updates instantly.

## UI/UX States

- Maintain existing loading/empty/error components; verify that Past tab transitions from empty → populated without flicker by relying on derived memo data.

## Edge Cases

- Session snapshot must handle unauthenticated state (no Supabase call needed) and logouts (clear store, notify listeners).
- Bookings data may temporarily be undefined during refetch; ensure memo falls back to empty arrays without throwing and that badges + content stay consistent.

## Testing Strategy

- Unit-ish: add tests or at least type-safe checks for the new session store (if feasible) and ensure `BookingListClient` memo logic covered via existing integration tests (manual verification acceptable).
- Manual: Use Chrome DevTools MCP to verify no recurring `/auth/v1/user` requests on guest dashboard and ensure cancelling a booking immediately surfaces it under Past.

## Rollout

- Default to immediate rollout after verification; note if feature flag exists.

## DB Change Plan (if applicable)

- N/A (no DB changes anticipated).

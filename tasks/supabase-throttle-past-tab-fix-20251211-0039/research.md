---
task: supabase-throttle-past-tab-fix
timestamp_utc: 2025-12-11T00:39:00Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Supabase 429 & Past Tab Rendering

## Requirements

- Functional: prevent Supabase auth polling from causing 429 errors; ensure Past tab list reflects actual data when counts change.
- Non-functional: no regressions to auth state refresh cadence; consistent UI responsiveness.

## Existing Patterns & Reuse

- `hooks/useSupabaseSession.tsx` already centralizes `supabase.auth.getSession()` + `onAuthStateChange` updates and exposes `{ session, user, status }` via React context (hydrated from `AppProviders`).
- Multiple client components (`components/LayoutClient` → `CrispChat`, `components/ButtonSignin`, analytics emitter) still call `supabase.auth.getUser()` directly on mount to warm up data, bypassing the shared session context.
- Guest bookings UI uses `useGuestBookings` (TanStack Query) to load a combined list of reservations and derives `upcoming`/`past` arrays client-side inside `BookingListClient`.

## External Resources

- [Supabase auth rate limits](https://supabase.com/docs/guides/auth/limits) — repeated `getUser()` calls hit `/auth/v1/user`, which is rate limited to ~20 req/min per IP on free tier.

## Constraints & Risks

- Need to respect Supabase auth limits without breaking session refresh (session context must remain source of truth; no stale globals containing tokens).
- Past bookings UI currently filters client-side; any adjustments must keep optimistic cancel updates and avoid double counting.
- Non-React modules (analytics) cannot use hooks; require a store or event bridge to reuse session data without new Supabase calls.

## Open Questions (owner, due)

- Which module currently triggers frequent `supabase.co/auth/v1/user` calls? (owner: factory-droid, due: ASAP)
- Does Past tab rely on stale SWR cache or query invalidation? (owner: factory-droid, due: ASAP)

## Recommended Direction (with rationale)

- Introduce a lightweight session snapshot store that `SupabaseSessionProvider` updates so non-React modules (analytics) and components like `ButtonSignin`/`CrispChat` can consume the already-fetched session instead of calling `supabase.auth.getUser()` again; fall back to a single `getUser()` only if the context is still loading.
- For the bookings UI, ensure optimistic cancellation flows immediately move records from `upcoming` to `past` by reusing query data (`useCancelBooking` already mutates caches, but `BookingListClient` should stay in sync by reacting to derived arrays and confirming we filter on status before comparing timestamps).

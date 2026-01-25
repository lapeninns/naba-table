---
task: fix-bookings-refresh
timestamp_utc: 2026-01-25T13:46:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix bookings not updating across devices

## Requirements

- Functional:
  - Guest bookings data should refresh across devices without requiring re-login.
  - Preserve existing UI states (loading/empty/error) and keep UX stable.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Avoid excessive polling; only refresh when visible and/or on focus/reconnect.
  - No auth/session regressions; no exposure of PII beyond existing behavior.

## Existing Patterns & Reuse

- Guest bookings data is fetched via `useGuestBookings` (React Query) and used in:
  - `src/components/features/guest/dashboard/GuestDashboardClient.tsx`
  - `src/components/features/booking/list/BookingListClient.tsx`
- React Query defaults in `src/app/providers.tsx` set `refetchOnWindowFocus: false` globally.
- Stale time for bookings queries is 45s in `lib/query/staleTimes.ts`.
- Ops bookings list uses realtime + polling with visibility gating in `src/hooks/ops/useOpsBookingsList.ts`.

## External Resources

- N/A (internal patterns sufficient)

## Constraints & Risks

- Guest hooks under `src/guest/**` should reuse services and avoid direct Supabase calls.
- Polling too aggressively could add load; prefer visibility-aware polling.

## Open Questions (owner, due)

- Q: Which exact bookings screen is stale?
  A: Likely guest dashboard or guest bookings list (owner: github:@amankumarshrestha, due: 2026-01-25)
- Q: Desired refresh behavior (realtime vs refresh-on-focus/polling)?
  A: Default to focus + visible polling unless requested realtime (owner: github:@amankumarshrestha, due: 2026-01-25)

## Recommended Direction (with rationale)

- Add a focused refresh policy to `useGuestBookings`:
  - Enable `refetchOnWindowFocus` + `refetchOnReconnect`.
  - Add visibility-gated polling (e.g., 60s) to refresh while the tab is open.
  - Keep existing caching and SSR hydration to avoid layout regressions.

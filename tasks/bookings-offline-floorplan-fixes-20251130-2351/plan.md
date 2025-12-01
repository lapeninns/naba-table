---
task: bookings-offline-floorplan-fixes
timestamp_utc: 2025-11-30T23:51:38Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Bookings date filter, floor-plan walk-in, offline handling

## Objective

We will ensure bookings respect explicit dates (including future dates), restore floor-plan walk-in seating action, and provide in-app offline handling so operators can manage future days and disruptions confidently.

## Success Criteria

- [ ] `/bookings?date=<YYYY-MM-DD>` respects that day (UTC or restaurant TZ) and returns the correct list/empty state; Dashboard and Bookings show the same day.
- [ ] Switching statuses/search/pagination keeps the requested date in the URL and results; no silent fall back to today.
- [ ] "Walk-in Seating" on floor plan triggers navigation to the walk-in wizard with prefilled date/time/party, with a visible action/feedback, and works on desktop + tablet + mobile.
- [ ] Offline navigation inside the ops shell stays in-app (no ERR_INTERNET_DISCONNECTED), shows a clear offline message, and preserves cached content until reconnection.

## Architecture & Components

- Bookings date handling
  - `src/app/app/(app)/bookings/page.tsx` — parse `date` search param via `sanitizeDateParam`; pass to client.
  - `src/components/features/bookings/OpsBookingsClient.tsx` — accept `initialDate`; compute date range with restaurant timezone (via `useOpsRestaurantDetails`) and thread into `useOpsBookingsList` filters; surface applied date badge.
  - `src/hooks/ops/useOpsBookingsTableState.ts` — add optional `initialDate` and `dateRange` support so queryFilters include explicit `from`/`to` (start-of-day → next-day) when provided.
  - Add small pure helper for building date ranges (testable) if needed.
- Floor-plan walk-in CTA
  - `src/app/app/(app)/seating/floor-plan/page.tsx` — guard `router` usage, debounce/deduplicate clicks, add optimistic feedback (toast/button loading) and ensure params include date/time/party.
- Offline handling
  - `src/components/features/ops-shell` — add `OpsOfflineIndicator`/guard in `OpsSidebarLayout` top bar and wrap nav links with offline-aware click handler to block navigation when offline and show guidance (reuse `useOnlineStatus`, `BookingOfflineBanner` patterns, `useToast`).

## Data Flow & API Contracts

- Bookings list: `useOpsBookingsList` already supports `from`/`to`; we will compute `{from: startOfDayTZ(date), to: startOfNextDayTZ(date)}` when `date` is provided. Keep existing status/query/page params intact.
- Dashboard contract unchanged; we mirror its `date` param via `sanitizeDateParam` to keep both views aligned.
- Walk-in CTA passes `date`, `time` (HH:mm), `partySize` via query string to `/app/walk-in` (wizard consumes these).
- Offline guard does not change backend contracts; it blocks client-side nav while offline and surfaces cached data via React Query persistence already configured.

## UI/UX States

- Bookings list: shows applied date chip/badge; empty state for future date should be visible and not revert to today. Loading/empty/error unchanged.
- Floor plan: Walk-in button shows progress/tooltip when launching wizard; handles disabled state if prerequisites missing.
- Offline: persistent shell banner + toast when nav blocked; nav items visually disabled while offline; retry/refresh affordance when back online.

## Edge Cases

- Invalid `date` param (malformed) should safely ignore and fall back to current behavior without crashes.
- Timezone mismatches: if restaurant timezone unavailable, default to UTC to avoid mis-filtering.
- Double-clicking Walk-in CTA should not queue duplicate navigations.
- Offline → online transition should allow nav again and clear disabled state.

## Testing Strategy

- Unit: date-range helper (builds start/end) with/without timezone; walk-in CTA handler debounce if feasible (pure util or mock router).
- Component smoke (manual/automated) for OpsBookingsClient date param: `/bookings?date=future` renders empty state, preserves date on filter change.
- Manual QA (DevTools MCP):
  - Bookings view with future date (desktop + mobile viewport) for empty state and URL sync.
  - Floor-plan walk-in click from available table (desktop + iPad + iPhone emulation) opens wizard with prefilled params.
  - Offline: toggle DevTools Offline then click nav links → in-app banner/toast, no browser error; back online -> navigation succeeds.
- A11y: focusable offline banner/controls; button remains keyboard-activatable.

## Rollout

- No new flag planned (bugfix). Keep scope narrow.
- Telemetry: reuse existing logging if available; optional console.warn for blocked offline nav (remove before merge if noisy).
- Rollback: revert the touched files; no DB changes.

## DB Change Plan (if applicable)

- None anticipated; if identified, will add staging-first plan.

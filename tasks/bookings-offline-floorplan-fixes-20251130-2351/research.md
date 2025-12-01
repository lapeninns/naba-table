---
task: bookings-offline-floorplan-fixes
timestamp_utc: 2025-11-30T23:51:38Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Bookings date filter, floor-plan walk-in, offline handling

## Requirements

- Functional:
  - Bookings view must respect explicit `date` query param (including future dates) and show correct empty state when no bookings exist.
  - Floor-plan "Walk-in Seating" control should seat a walk-in table-side (desktop + iPad + iPhone) with conflict/capacity validation.
  - App should handle offline navigation with an in-app offline message/cached view instead of browser error page.
  - Date handling must be consistent across Dashboard and Bookings views for future service dates.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Accessible states/messages for offline and empty states; keyboard/screen-reader friendly.
  - Avoid regressions in booking loading performance and floor-plan interactions; keep behavior consistent across viewports.
  - No secrets in source; follow existing auth/PII handling.

## Existing Patterns & Reuse

- **Bookings view**: `/app/(app)/bookings/page.tsx` is a server component that parses search params for `filter`, `page`, `restaurantId`, `query`, `statuses` but **ignores `date`**. It delegates to the client component `OpsBookingsClient`.
- **Client bookings logic**: `src/components/features/bookings/OpsBookingsClient.tsx` relies on `useOpsBookingsTableState` (ops hook) to build filters. The hook currently derives `from/to` using `new Date()` based on status, so it automatically clamps to “today” and never honors a requested service date. It syncs other filters (status, search, page, statuses) to the URL via `router.replace`.
- **Filtering API contract**: `useOpsBookingsList` (hook) normalizes filters and calls `bookingService.listBookings` which accepts `from`/`to` (Date|string). `OpsBookingsFilters` type supports explicit `from`/`to` ranges.
- **Dashboard date handling**: `/app/(app)/page.tsx` passes `sanitizeDateParam` to `OpsDashboardClient`, which keeps `selectedDate` in state and syncs it to `?date=` in the URL. Dashboard APIs accept `targetDate` and show empty state for future dates—this is the desired pattern to mirror.
- **Offline scaffolding**: `BookingOfflineQueueProvider` + `BookingOfflineBanner` already provide offline messaging/queuing for booking mutations. Query persistence (`lib/query/persist.ts`) registers `onlineManager` and caches queries in `localStorage`, giving us cached data to reuse when offline.
- **Walk‑in from floor plan**: `/app/(app)/seating/floor-plan/page.tsx` shows a “Walk-in Seating” button when a table is available. The onClick builds params (`date`, `time`, `partySize`) and calls `router.push('/app/walk-in?...')`. The target wizard (`WalkInWizardClient`) consumes those params to prefill the flow.
- **Navigation shell**: `OpsSidebarLayout` renders navigation links (no offline guard) via `<Link>`; offline navigation currently attempts a new fetch and falls through to browser offline page.

## External Resources

- (Add docs/spec links if consulted) — why it matters.

## Constraints & Risks

- Need to keep bookings filters backward compatible for existing status/query/pagination URL params.
- Future-date support must respect restaurant timezone to avoid off-by-one day (dashboard relies on `sanitizeDateParam` + server-provided `summary.date`).
- Floor-plan walk-in path must continue to prefill the wizard and not bypass capacity/conflict validation handled by the wizard.
- Offline handling cannot rely on new infra (service worker) per scope; must leverage existing React Query persistence and UI-level guards without breaking online nav.

## Open Questions (owner, due)

- Q: What is the canonical source of truth for current service date across views? (owner: @assistant, due: before implementation)
- Q: Is there an existing offline banner/component to reuse? (owner: @assistant)

Notes: Dashboard currently treats `summary.date` from API as canonical. `BookingOfflineBanner` exists for mutations; we may extend shell-level offline UX.

## Recommended Direction (with rationale)

- **Bookings date handling**: Parse `date` search param using the existing `sanitizeDateParam`, derive a day range in restaurant timezone, and pass explicit `from`/`to` to `useOpsBookingsList`. Sync selected date back to URL so the empty state for future dates is visible and consistent with Dashboard.
- **Floor-plan walk-in CTA**: Ensure the button always fires by guarding against missing router/table data, debounce double clicks, and pass through selected date/time/party size to `/app/walk-in` (wizard already pre-fills). Add a toast/feedback so ops know navigation is happening; keep within existing wizard flow for validation.
- **Offline handling**: Add an ops-shell offline guard that (a) surfaces a clear offline overlay/banner, (b) prevents client navigations that would crash when offline and instead shows guidance + retry, while leaving existing cached view usable. Reuse `useOnlineStatus` + React Query persistence; avoid new service worker.

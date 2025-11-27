---
task: bookings-sort-order
timestamp_utc: 2025-11-27T14:32:42Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ensure bookings list shows most recently created first

## Requirements

- Functional: The bookings list at https://app.nabatable.com/bookings should show the most recently created bookings first (descending by creation date/time).
- Non-functional (a11y, perf, security, privacy, i18n): Preserve existing accessibility and performance characteristics; no new data exposure.

## Existing Patterns & Reuse

- Ops bookings page (`src/app/app/(app)/bookings/page.tsx`) renders `OpsBookingsClient`, which defaults to the **Recent** filter.
- Client state (`useOpsBookingsTableState`) sets `sort='desc'` and `sortBy='created_at'` when filter is `recent`.
- Data fetch flows through `useOpsBookingsList` → `bookingService.listBookings` → `/api/ops/bookings`.
- API handler (`src/app/api/ops/bookings/route.ts`) orders results via `orderColumn = params.sortBy === "created_at" ? "created_at" : "start_at"` with `ascending: params.sort === "asc"`.

## External Resources

- None yet.

## Constraints & Risks

- Sorting change must not break pagination or filters.
- Ensure ordering uses creation timestamp not start date if different.

## Open Questions (owner, due)

- Are there server-side sort options already available? (owner: assistant, due: 2025-11-27)

## Recommended Direction (with rationale)

- Ensure the API enforces `created_at` descending for the `recent` view, eliminating any fallback to `start_at`/ascending defaults. Minimal API-side change keeps client behavior unchanged and guarantees latest-created bookings appear first.

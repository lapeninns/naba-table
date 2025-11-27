---
task: booking-recency-sort
timestamp_utc: 2025-11-27T15:04:25Z
owner: github:@assistant
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Booking recency sorting

## Requirements

- Functional: Ops bookings view at `/bookings` (app subdomain) must show newest created bookings first when the "Recent" filter is selected; a booking created moments ago should appear at the top of page 1.
- Non-functional (a11y, perf, security, privacy, i18n): No UI changes planned; keep existing paging/query behavior and auth/authorization intact. No DB migrations.

## Existing Patterns & Reuse

- Bookings list page: `src/app/app/(app)/bookings/page.tsx` renders `OpsBookingsClient`.
- Client state hook `useOpsBookingsTableState` sets `sortBy="created_at"` and `sort="desc"` for the "recent" filter.
- API endpoint `src/app/api/ops/bookings/route.ts` accepts `sort` and `sortBy` in `opsBookingsQuerySchema` and orders results accordingly.

## External Resources

- None required; all logic is in-repo (Next.js + Supabase).

- Supabase is remote-only; avoid schema changes. The fix must remain a pure API/logic change.
- Sorting behavior must remain stable for other filters (start_at asc/desc). Regression risk in query parameter parsing.

## Open Questions (owner, due)

- Q: Do we need to backfill or clean any rows with null `created_at`? (Owner: TBD) — assumption: `created_at` is always populated by DB default, so no backfill needed for this fix.

## Recommended Direction (with rationale)

- Parse `sortBy` from the request query in the ops bookings GET handler so the server respects client-provided `sortBy=created_at` and `sort=desc` for the "recent" filter. Add a unit test to lock the behavior and avoid regressions.

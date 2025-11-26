---
task: reset-zones-seed
timestamp_utc: 2025-11-26T00:23:00Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: low
flags: []
related_tickets: []
---

# Research: Reset zones & tables seed

## Requirements

- Functional: provide a SQL seed that removes existing zones and tables for the Waterbeach restaurant and inserts the requested layout (Main Dining 1 inside/outside, Main Dining 2, Bar) with the specified movable vs fixed counts.
- Non-functional: must stay compatible with current schema (zones, table_inventory, booking_table_assignments FKs) and avoid local Supabase usage per policy.

## Existing Patterns & Reuse

- `supabase/seeds/white-horse-service-periods.sql` already implements a targeted reset-and-reseed flow for the White Horse slug (`white-horse-pub-waterbeach`), including zone deletion, allowed capacity reset, and table inserts matching the requested counts.
- `supabase/utilities/reset-for-waterbeach.sql` truncates all domain tables when a full reset is required prior to seeding.

## External Resources

- None needed; all required logic lives in the repo seeds/utilities SQL.

## Constraints & Risks

- Supabase operations must be remote-only; do not run against a local instance.
- Booking/table assignments must be cleared before deleting tables to satisfy FKs; the existing seed handles this.
- Need the restaurant slug to remain `white-horse-pub-waterbeach`; if changed, the target lookup must be updated.

## Open Questions (owner, due)

- Confirm target restaurant slug/environment for execution (owner: github:@assistant, due: before execution).

## Recommended Direction (with rationale)

- Reuse the existing `white-horse-service-periods.sql` seed because it already encodes the exact counts and mobility mix requested. Provide run commands for (a) full reset + seed and (b) targeted re-seed only, so ops can pick the safe scope.

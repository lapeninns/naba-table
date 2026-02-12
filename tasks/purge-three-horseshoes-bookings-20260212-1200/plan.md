---
task: purge-three-horseshoes-bookings
timestamp_utc: 2026-02-12T12:00:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Purge all bookings for Three Horseshoes

## Objective

Permanently delete all booking records belonging to the Three Horseshoes restaurant, including booking-linked operational rows, so the restaurant has 0 bookings remaining.

## Success Criteria

- [ ] `bookings` count for restaurant slug `three-horseshoes` is 0 after apply.
- [ ] Deletion is scoped by restaurant and uses service-role credentials (bypassing RLS intentionally for admin operation).
- [ ] Script supports dry run by default and requires explicit apply confirmation flags.

## Approach

- Add canonical admin script: `scripts/purge-restaurant-bookings.ts`.
- Dry run: resolve restaurant, count bookings, fetch booking IDs, print preview.
- Apply: delete booking-linked rows in known dependent tables (best-effort; missing tables are ignored), then delete `bookings`.

## Safety Rails

- Dry run by default (no writes).
- Apply requires:
  - `--apply`
  - `CONFIRM_PRODUCTION=true`
  - `CONFIRM_PURGE_BOOKINGS=true`
  - `EXPECTED_PROJECT_REF=<ref>` verification (required).

## Testing Strategy

- Run script in dry-run mode first.
- Run script in apply mode only after verifying the resolved restaurant id/slug and booking count.
- Re-run dry run to confirm bookings count is 0.

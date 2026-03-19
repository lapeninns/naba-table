---
task: seed-oldcrown-staging-bookings
timestamp_utc: 2026-03-19T00:37:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification Report

## Test Outcomes

- [x] Past seed run
- [x] Present seed run
- [x] Future seed run
- [x] Verification query

## Findings

- Target restaurant: `The Old Crown Girton` -> `a050d1ad-1ee0-4ea0-abc2-22c3778aa52c`.
- Seed path used: `npx tsx scripts/generate-bookings-safe.ts`.
- Requested runs:
  - Past: `BOOKING_DATE=2026-03-18`, `BOOKING_COUNT=6`
  - Present: `BOOKING_DATE=2026-03-19`, `BOOKING_COUNT=6`
  - Future: `BOOKING_DATE=2026-03-26`, `BOOKING_COUNT=6`
- Verified inserted rows created during this run:
  - `2026-03-18`: 3 bookings
  - `2026-03-19`: 4 bookings
  - `2026-03-26`: 6 bookings
- All verified sample rows are `status=confirmed`.
- Lower counts on the first two runs were caused by existing `customers` unique-key collisions on deterministic phone numbers in the reusable script.

## Artifacts

- `artifacts/seed-past.txt`
- `artifacts/seed-present.txt`
- `artifacts/seed-future.txt`
- `artifacts/verify-bookings.txt`

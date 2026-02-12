---
task: purge-three-horseshoes-bookings
timestamp_utc: 2026-02-12T12:00:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Summary

- Target restaurant: `three-horseshoes`
- Operation: purge all bookings (admin)
- Current env/project ref (from `.env.local`): `ndxmivcrehsacuerwxtm`

## Commands Run

- Dry run:
  - `RESTAURANT_SLUG=three-horseshoes pnpm -s tsx scripts/purge-restaurant-bookings.ts`
- Apply:
  - `CONFIRM_PRODUCTION=true CONFIRM_PURGE_BOOKINGS=true EXPECTED_PROJECT_REF=<ref> RESTAURANT_SLUG=three-horseshoes pnpm -s tsx scripts/purge-restaurant-bookings.ts --apply`
- Post-check dry run:
  - `RESTAURANT_SLUG=three-horseshoes pnpm -s tsx scripts/purge-restaurant-bookings.ts`

## Outcomes

- Bookings before (dry run): 661
- Bookings after (post-check dry run): 0
- Applied at (UTC): 2026-02-12T12:42:30Z

## Artifacts

- Dry run output: `artifacts/dry-run.txt`
- Apply output: `artifacts/apply.txt`
- Post-check output: `artifacts/post-check.txt`

## Notes / Risks

- This operation is a hard delete of booking data and booking-linked operational rows.

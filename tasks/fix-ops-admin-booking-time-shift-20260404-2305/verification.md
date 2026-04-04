---
task: fix-ops-admin-booking-time-shift
timestamp_utc: 2026-04-04T23:05:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Not applicable for this change.

- This fix is server-side only and does not alter UI behavior or presentation.
- Verification will use focused automated route coverage plus scoped lint/typecheck instead.

## Test Outcomes

- [x] `npx vitest run tests/server/ops-booking-route.test.ts tests/guest/bookingDateTime.test.ts`
- [x] `npx eslint 'src/app/api/ops/bookings/[id]/route.ts' tests/server/ops-booking-route.test.ts`
- [x] `pnpm typecheck`

## Verification Notes

- Added focused route coverage in `tests/server/ops-booking-route.test.ts`.
- Verified the DST regression path: `2026-07-01T18:30:00.000Z` for an `Europe/London` restaurant now persists as `19:30`.
- Verified note-only ops edits preserve the existing venue-local `end_time` instead of rewriting it via server-local `Date#getHours()`.

## Artifacts

- Task notes: `tasks/fix-ops-admin-booking-time-shift-20260404-2305/`

## Known Issues

- None yet.

## Sign-off

- [x] Engineering

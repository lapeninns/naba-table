---
task: fix-ops-admin-booking-time-shift
timestamp_utc: 2026-04-04T23:05:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix Ops Admin Booking Time Shift

## Objective

We will preserve the venue-local booking time selected in ops admin so that edited bookings no longer save one hour earlier during DST or other non-UTC venue timezones.

## Success Criteria

- [ ] Ops admin PATCH derives `booking_date`, `start_time`, and `end_time` in the restaurant timezone.
- [ ] Note-only updates do not rewrite `end_time` one hour earlier.
- [ ] Focused automated coverage proves the London DST regression case.

## Architecture & Components

- `src/app/api/ops/bookings/[id]/route.ts`: replace runtime-local time derivation with `server/bookings/timezoneConversion.ts`.
- `tests/server/ops-booking-route.test.ts`: mock the route boundary and assert the persisted payload uses venue-local clock values.

## Data Flow & API Contracts

Endpoint: `PATCH /api/ops/bookings/:id`
Request: `{ startIso, endIso?, partySize, notes? }`
Response: unchanged contract
Errors: unchanged contract; invalid ISO/timezone conversion still returns `400`

## UI/UX States

- No UI change. This is a server-side correctness fix.

## Edge Cases

- Explicit `endIso` present
- No explicit `endIso` and existing `end_at` must be preserved
- Venue timezone differs from server/runtime timezone
- Unified validation flag on or off should receive the same corrected derived values

## Testing Strategy

- Verification-first regression fix: confirm the failing ops route behavior from code inspection, then add focused route tests.
- Automated: Vitest route test for London DST admin edit paths.
- Validation: scoped ESLint and `pnpm typecheck`.

## Rollout

- No feature flag change.
- Ship directly on the canonical ops admin route.
- Monitor booking edit reports after merge.

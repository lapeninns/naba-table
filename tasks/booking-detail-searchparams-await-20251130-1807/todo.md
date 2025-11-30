---
task: booking-detail-searchparams-await
timestamp_utc: 2025-11-30T18:07:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm pattern for `searchParams` usage in similar routes (reference existing code).

## Core

- [x] Update `src/app/(public)/bookings/[bookingId]/page.tsx` to await `searchParams` once and derive `token` safely.
- [x] Ensure normalized bookingId and redirect logic remain unchanged.

## UI/UX

- [x] Manual smoke of `/bookings/:id` for runtime errors; verify page renders (redirected to sign-in without errors).
- [x] Verify keyboard navigation/focus still works on loaded page (basic check).

## Tests

- [x] Run `pnpm run lint` (or targeted lint) after code change.
- [x] Capture manual QA notes + artifacts in `verification.md`.

## Notes

- Assumptions: Only runtime issue is sync access to `searchParams`; no behavioral changes needed.
- Deviations: None yet.

## Batched Questions

- None currently.

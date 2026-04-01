---
task: booking-flow-audit
timestamp_utc: 2026-04-01T16:32:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm which review findings are real bugs vs intentional behavior changes.
- [x] Re-check touched files before editing.

## Core

- [x] Add backward-compatible waitlist phone lookup candidates in `server/bookings.ts`.
- [x] Rewrite touched waitlist rows to canonical phone storage.
- [x] Normalize stored booking emails in self-serve ownership comparisons.
- [x] Restore `next-env.d.ts` to a safe generated baseline.

## UI/UX

- [x] Remove dead `isVisuallyDisabled` branch from `OpsBookingCard.tsx`.

## Tests

- [x] Update waitlist regression test to cover dual-format lookup.
- [x] Run focused vitest coverage for booking/contact regression paths.
- [x] Run `pnpm typecheck`.

## Notes

- Assumptions:
  - Forward rewrite-on-touch is sufficient for waitlist compatibility without a migration.
  - Current ops card callers do not rely on a separate visual-disabled state when not loading.
- Deviations:
  - No Chrome DevTools pass was required because this follow-up is backend/framework/dead-code only and does not change user-facing UI behavior.

## Batched Questions

- None.

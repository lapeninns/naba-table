---
task: lint-cleanup
timestamp_utc: 2025-12-05T15:50:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review each lint-reported file for unused imports/vars and hook deps.

## Core

- [x] Remove unused `GuestHero` import in marketing restaurant page.
- [x] Remove unused `env` import in auth callback route.
- [x] Replace `any[]` session cookies with typed structure in e2e login route.
- [x] Remove unused import and mark unused prop in `ReceiptClient`.
- [x] Remove unused imports in `ReservationDetailClient`.
- [x] Remove unused `CalendarX` import in `BookingListClient`.
- [x] Remove unused imports/vars (`GuestStatus`, router, greetingEmoji, EmptyState) in `GuestDashboardClient`.
- [x] Inline `useMemo` dependencies in `useGuestBookings`.

## Tests

- [x] Run targeted lint: `pnpm eslint <touched file> --max-warnings=0`.

## Notes

- Engine warning (Node 22 vs 20.11.1) expected during lint runs.

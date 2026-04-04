---
task: fix-ops-admin-booking-time-shift
timestamp_utc: 2026-04-04T23:05:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect the canonical ops booking edit flow and confirm the failing route.
- [x] Create the task folder and task artifacts.

## Core

- [x] Replace runtime-local clock extraction in `src/app/api/ops/bookings/[id]/route.ts`.
- [x] Ensure note-only edits preserve venue-local `end_time`.

## UI/UX

- [x] No UI surface change.

## Tests

- [x] Add focused route regression coverage.
- [x] Run scoped validation (`vitest`, `eslint`, `typecheck`).

## Notes

- Assumptions:
  - Restaurant relation timezone is the correct initial source of venue-local conversion for ops edits.
- Deviations:
  - This is a verification-first regression fix rather than pure RED-first because the first step was confirming the live failing code path.

## Batched Questions

- None at the moment.

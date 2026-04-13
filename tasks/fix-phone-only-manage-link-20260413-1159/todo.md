---
task: fix-phone-only-manage-link
timestamp_utc: 2026-04-13T11:59:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm failure mode from current code paths and SMS evidence.
- [x] Add task-local notes and continuity update.

## Core

- [x] Relax session-recovery token contract to allow one contact method.
- [x] Centralize token-to-booking contact matching.
- [x] Update manage-link generation to issue tokens for phone-only bookings.
- [x] Update guest booking routes to use the shared contact-match helper.

## UI/UX

- [x] Preserve existing recover error behavior for truly missing-contact cases.

## Tests

- [x] Unit
- [x] Integration

## Notes

- Assumptions:
  - The correct behavior is to let phone-only ops bookings use the same guest recovery flow, not a separate fallback link.
- Deviations:
  - Verification-first root-cause analysis was used because the issue is a live regression with a concrete failing artifact.

## Batched Questions

- None currently.

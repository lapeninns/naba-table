---
task: old-school-house-access-followup-production
timestamp_utc: 2026-03-25T17:13:28Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm canonical role names and membership table.
- [x] Confirm the current review URL already matches the verified canonical Google Maps place page.
- [x] Add a guarded production access bootstrap script.

## Core

- [x] Dry-run user resolution and membership plan.
- [x] Apply the production access bootstrap.
- [x] Read back the final membership state.

## UI/UX

- [x] Not applicable.

## Tests

- [x] Dry-run verification recorded.
- [x] Applied verification recorded.

## Notes

- Assumptions:
  - `manager` is the correct role for the venue mailbox account.
  - No further review-URL mutation is needed if the current canonical Google Maps place page remains stored.
- Deviations:
  - `auth.admin.listUsers()` is failing in this environment, so DB and direct admin fallbacks are required.

## Batched Questions

- None.

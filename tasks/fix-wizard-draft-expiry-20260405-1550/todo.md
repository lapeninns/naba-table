---
task: fix-wizard-draft-expiry
timestamp_utc: 2026-04-05T15:50:00Z
owner: github:@amankumarshresthaa
reviewers: [github:@amankumarshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm current draft expiry behavior in the reservation wizard
- [x] Identify canonical storage and restore paths

## Core

- [x] Tighten scoped draft loading to avoid unrelated legacy/global fallback
- [x] Preserve generic-route legacy draft restore behavior
- [x] Keep contact hydration aligned with the selected draft only

## UI/UX

- [x] Ensure plan alert messaging is only driven by the active draft result

## Tests

- [x] Add focused regression tests for scoped vs legacy draft loading
- [x] Run targeted reservation wizard tests

## Notes

- Assumptions:
  - The main false-positive path comes from restaurant-scoped routes restoring the legacy global key.
- Deviations:
  - Verification-first investigation used before adding tests because this is a regression fix.
  - Chrome DevTools route proof was attempted on the local reserve harness, but the slugged route hit the app error boundary before the wizard became interactive.

## Batched Questions

- None at the moment.

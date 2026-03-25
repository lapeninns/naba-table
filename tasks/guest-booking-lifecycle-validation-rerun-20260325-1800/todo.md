---
task: guest-booking-lifecycle-validation-rerun
timestamp_utc: 2026-03-25T18:00:52Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect paused mission state, current worktree status, and validation contract.
- [x] Reproduce the stale booking-detail and receipt validation flows on the live runtime.

## Core

- [x] Fix tokenized receipt continuity through client hydration/refetch.
- [x] Fix rebook destination continuity so the guest reaches a canonical booking-entry route.
- [x] Add a dev-only harness for booking-detail loading and error states.
- [x] Add a dev-only harness for guest receipt lifecycle validation when local seeded receipt records are absent.

## UI/UX

- [x] Keep new validation surfaces on shared guest primitives and existing booking-detail UI.
- [x] Preserve accessible loading/error/empty messaging.

## Tests

- [x] Unit / integration
- [x] Playwright
- [x] Typecheck
- [x] Lint
- [x] Chrome DevTools MCP manual QA

## Notes

- Assumptions:
  - The live port-3000 server is already running from the mission worktree.
- Deviations:
  - The paused validator uncovered live-runtime implementation gaps, so this continuation includes code fixes before artifact updates.
  - The connected remote dataset does not contain the historical receipt validation bookings (`333...`, `444...`, `555...`), so browser receipt lifecycle validation now uses a dev-only harness for truthful UI evidence.

## Batched Questions

- None.

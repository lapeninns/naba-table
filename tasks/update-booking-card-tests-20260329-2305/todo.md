---
task: update-booking-card-tests
timestamp_utc: 2026-03-29T23:05:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect booking card utils, component contract, and existing tests

## Core

- [x] Update view-model normalization expectations
- [x] Update action policy and pending-mutation component expectations
- [x] Refresh any impacted selector/component tests

## UI/UX

- [x] Verify details action/rendering rules across mobile and desktop expectations
- [x] Verify notes hint and party-size wording expectations

## Tests

- [x] Run targeted Vitest suites

## Notes

- Assumptions:
- The rebuilt card contract should normalize display-facing booking fields before rendering.
- Deviations:
- Browser QA could not be completed because the local Next/Turbopack dev server fails to resolve `tailwindcss` from the worktree parent path.

## Batched Questions

- None currently

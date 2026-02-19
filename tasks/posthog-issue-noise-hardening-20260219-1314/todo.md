---
task: posthog-issue-noise-hardening
timestamp_utc: 2026-02-19T13:14:13Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and SDLC artifacts.
- [x] Confirm top PostHog issue fingerprints and paths.

## Core

- [x] Harden client error reporter fetch rejection handling.
- [x] Add canonical PostHog exception suppression predicate.
- [x] Wire suppression predicate into PostHog `before_send`.
- [x] Add suppression debug state to `window` (counts + recent samples) for production DevTools triage.

## Tests

- [x] Add focused unit tests for suppression predicate.
- [x] Run lint, test, and typecheck for touched scope.

## Notes

- Assumptions:
  - `Object Not Found Matching Id:* MethodName:update, ParamCount:4` is non-actionable storage-layer noise.
- Deviations:
  - None yet.

## Batched Questions

- None.

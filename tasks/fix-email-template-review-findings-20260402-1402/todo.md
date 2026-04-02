---
task: fix-email-template-review-findings
timestamp_utc: 2026-04-02T14:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create follow-up task folder and document review-fix scope.

## Core

- [x] Make manual template test sends use unique idempotency keys.
- [x] Merge template updates against the latest persisted document.
- [x] Keep text/plain CTA URLs aligned with resolved HTML CTA URLs.

## UI/UX

- [x] No UI changes required.

## Tests

- [x] Add server regression tests for test-send idempotency.
- [x] Add server regression tests for concurrent-safe template merges.
- [x] Add server regression tests for text/plain CTA parity.
- [x] Run targeted Vitest suite.

## Notes

- Assumptions:
  - No schema change is needed; latest-document merge is sufficient for this branch.
- Deviations:
  - Chrome DevTools verification was not needed because the follow-up was server-only and did not change a UI surface.

## Batched Questions

- None.

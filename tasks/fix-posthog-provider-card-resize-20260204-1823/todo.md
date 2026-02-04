---
task: fix-posthog-provider-card-resize
timestamp_utc: 2026-02-04T18:23:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and artifacts

## Core

- [x] Keep PostHog provider mounted with stable client reference
- [x] Add responsive media-query hook for booking cards

## UI/UX

- [ ] Verify mobile/desktop card behavior on resize

## Tests

- [ ] Lint (targeted)
- [ ] Typecheck
- [ ] Chrome DevTools MCP QA (if UI run available)

## Notes

- Assumptions:
- Manual QA may be deferred if app runtime unavailable.
- Deviations:
- None.

## Batched Questions

- None.

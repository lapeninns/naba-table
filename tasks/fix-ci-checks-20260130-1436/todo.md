---
task: fix-ci-checks
timestamp_utc: 2026-01-30T14:36:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Update ZAP baseline workflow permissions or issue creation behavior.
- [x] Update trufflehog action tag to a valid release.

## Core

- [x] Guard DB drift check when `DRIFT_CHECK_DB_URL` is missing.
- [x] Update Lighthouse step to use available CLI.
- [x] Skip Accessibility job when no tests exist.
- [x] Skip Preview Deploy job when Vercel secrets are missing.

## Tests

- [ ] Validate workflows (syntax) and run local tests if needed.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- What is the expected behavior for Vercel check failures on PRs without secrets?

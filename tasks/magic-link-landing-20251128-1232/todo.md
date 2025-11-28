---
task: magic-link-landing
timestamp_utc: 2025-11-28T12:32:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Update redirect utils to allow absolute `www` host and safe paths.

## Core

- [x] Apply new sanitizer/normalizer in signin route for magic-link targets.
- [x] Apply new redirect resolution in callback route.

## Verification

- [ ] Manual test guest magic-link: lands on `https://www.nabatable.com/guest` (or localhost unchanged).
- [ ] Manual test restaurant magic-link: lands on `https://www.nabatable.com/app`.

## Notes

- Assumptions: root domain env set to `nabatable.com` in production; localhost should remain relative.
- Deviations: No automated tests added due to scope.

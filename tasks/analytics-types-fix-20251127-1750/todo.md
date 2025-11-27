---
task: analytics-types-fix
timestamp_utc: 2025-11-27T17:50:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Add typed Plausible event options interface.

## Core

- [x] Update `PlausibleWindow` to use strict types instead of `any`.

## Tests

- [x] Run ESLint on `lib/analytics.ts` to ensure warnings are gone.

## Notes

- Assumptions: Plausible accepts `props`, `url`, `referrer`, `revenue`, and `callback` fields.
- Deviations: None yet.

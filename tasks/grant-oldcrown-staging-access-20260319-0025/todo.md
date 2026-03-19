---
task: grant-oldcrown-staging-access
timestamp_utc: 2026-03-19T00:25:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm canonical grant script
- [x] Confirm staging project ref
- [x] Confirm Old Crown slug

## Core

- [x] Run grant script for `oldcrown@lapeninns.com`
- [x] Verify resulting membership

## Notes

- Assumptions: “Old Crown” refers to `The Old Crown Girton` / `the-old-crown-girton`.
- Deviations: Script uses `CONFIRM_PRODUCTION=true` as a generic write guard even though the target is staging.
- Verification note: first script attempt hit a transient `fetch failed` while querying candidate user tables; retry succeeded.

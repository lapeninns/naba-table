---
task: grant-oldcrown-access
timestamp_utc: 2026-01-24T19:50:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Core

- [x] Find restaurant id for “Old Crown” in pre-staging.
- [x] Find user id for `oldcrown@lapeninns.com`.
- [x] Determine highest role value.
- [x] Insert or update membership.
- [x] Verify membership row.

## Notes

- Assumptions: Highest role available will be used (likely `owner` or `admin`).
- Deviations: None.

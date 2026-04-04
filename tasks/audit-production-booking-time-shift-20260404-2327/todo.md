---
task: audit-production-booking-time-shift
timestamp_utc: 2026-04-04T23:27:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create the task folder and artifacts.
- [x] Resolve the production Supabase project through the management API.

## Core

- [x] Query production `audit_logs` for post-BST booking updates.
- [x] Identify confirmed `-60 minute` `start_time` signatures.
- [x] Check whether any candidate bookings were later corrected.

## Tests

- [x] Verification is read-only production inspection; no automated code change validation required.

## Notes

- Assumptions:
  - A `start_time` shift of exactly `-60 minutes` after BST is the strongest reliable production signature available from audit data.
- Deviations:
  - This is an operational audit task, not a code-change task.

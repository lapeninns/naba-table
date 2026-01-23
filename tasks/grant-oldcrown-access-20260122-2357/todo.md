---
task: grant-oldcrown-access
timestamp_utc: '2026-01-22T23:57:47Z'
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm role to assign.

## Core

- [ ] Draft SQL to look up user + restaurant and insert membership.
- [ ] Add idempotent guard to prevent duplicate rows.

## Tests

- [ ] Provide verification SELECTs.

## Notes

- Assumptions: user already exists in `auth.users`.
- Deviations: none.

---
task: fix-ops-edit-regression
timestamp_utc: 2026-02-11T20:33:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Automated

- `pnpm -s exec tsc --noEmit --pretty false` ✅ (pass)

## Manual QA

- Pending:
- Edit a booking from Ops dashboard list (without changing start time).
- Edit a booking from Ops bookings page.
- Confirm request payload contains timezone-aware ISO (`Z` or `+00:00`).
- Confirm API returns 200 and booking refreshes.

## Artifacts

- None yet.

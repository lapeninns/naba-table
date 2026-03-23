---
task: slot-logic-production-rollout
timestamp_utc: 2026-03-23T13:45:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm production Supabase target from production env files.
- [x] Capture production before-state for Old Crown and built-in occasions.
- [ ] Add canonical migration for Old Crown interval override.

## Core

- [ ] Push rollout commit to `origin/main`.
- [ ] Apply production built-in occasion cleanup.
- [ ] Apply production Old Crown interval update.

## Tests

- [ ] Reconfirm relevant slot-logic automated coverage if needed.
- [ ] Verify production after-state snapshots.

## Notes

- Assumptions:
  - Production env files in the repo reflect the intended production Supabase project.
- Deviations:
  - Supabase CLI and `psql` are unavailable, so production apply uses direct production service-role data updates.

## Batched Questions

- None.

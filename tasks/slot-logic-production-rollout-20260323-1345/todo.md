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
- [x] Add canonical migration for Old Crown interval override.

## Core

- [x] Push rollout commit to `origin/main`.
- [x] Apply production built-in occasion cleanup.
- [x] Apply production Old Crown interval update.

## Tests

- [x] Reconfirm relevant slot-logic automated coverage if needed.
- [x] Verify production after-state snapshots.

## Notes

- Assumptions:
  - Production env files in the repo reflect the intended production Supabase project.
- Deviations:
  - Supabase CLI and `psql` are unavailable, so production apply uses direct production service-role data updates.
  - The first production write used the correct built-in occasion filter but the restaurant update had to be retried without `deleted_at` because `public.restaurants` in production has no such column.

## Batched Questions

- None.

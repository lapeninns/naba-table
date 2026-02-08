---
task: apply-staging-migration
timestamp_utc: 2026-02-07T13:39:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Plan: Apply Staging Migration

## Steps

1. Identify migrations added on 2026-02-06 UTC.
2. Perform a transactional dry-run against staging using `psql` + pooler endpoint.
3. Apply the migration in a transaction.
4. Verify:
   - index exists
   - functions exist
   - `service_role` has EXECUTE on both RPC functions
   - smoke call returns (even if empty)

## Rollback

- Drop functions and index if needed (see verification.md).

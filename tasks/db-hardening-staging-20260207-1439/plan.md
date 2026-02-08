---
task: db-hardening-staging
timestamp_utc: 2026-02-07T14:39:30Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Plan: DB Hardening + Index Hygiene + Loyalty Removal (Staging)

## Objective

Ship production-grade database hardening and schema cleanup on staging:

1. Remove allow-all RLS policies and over-broad table privileges on internal tables.
2. Add missing foreign-key indexes.
3. Remove redundant/duplicate indexes.
4. Remove loyalty feature fully (DB objects and code) since it is permanently deprecated.

## Implementation Strategy

- Add new canonical migrations under `supabase/migrations/`.
- Apply to staging directly via Postgres client tooling using the Supabase pooler connection.
- Capture before/after artifacts.

## Rollout

- Staging-only changes in this task.
- Production rollout will be a separate task once staging verification passes.

## Verification

- RLS/privileges:
  - Confirm no policies remain with `roles={public}` + `cmd=ALL` + `qual=true` on internal tables.
  - Confirm table grants for `anon`/`authenticated` are revoked on internal tables.
- Loyalty removal:
  - Confirm loyalty tables/types are gone.
  - Confirm app code builds/tests without loyalty stubs.
- Indexes:
  - Confirm missing FK index list shrinks to 0.
  - Confirm duplicate/redundant indexes are removed.

---
task: apply-staging-migration
timestamp_utc: 2026-02-07T13:39:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Apply Staging Migration

## Goal

Apply the migration(s) added on 2026-02-06 (UTC) from this branch to the canonical staging Supabase project.

## Scope

- Target: staging project `ndxmivcrehsacuerwxtm`.
- Apply only the migration added yesterday:
  - `supabase/migrations/20260206213430_ops_email_delivery_attempts_dashboard.sql`

## Notes / Constraints

- Staging DB was rebuilt from production `public` schema; Supabase CLI migration tracking state may not reflect the repo history.
- Using `supabase db push` could attempt to replay many historical migrations and fail.
- Therefore apply the single reviewed migration via Postgres client tooling (transactional dry-run + apply).

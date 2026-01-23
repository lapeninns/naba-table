---
task: nabatable-pre-staging-db-clone
timestamp_utc: 2026-01-22T12:45:16Z
owner: github:@maintainers
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Nabatable pre-staging DB clone

## Objective

We will create a new Supabase project `nabatable-pre-staging` and populate it with production data from `vrdiqfudmwydclqpydee` so that we have a pre-staging environment with identical data.

## Success Criteria

- [ ] New project exists in the correct org and region.
- [ ] Database data matches production at time of dump.
- [ ] Artifacts include dump/restore logs and verification notes.

## Architecture & Components

- Supabase MCP: create project, get connection details.
- PostgreSQL dump/restore: export production data, import into target.

## Data Flow & API Contracts

- Use Supabase management API via MCP to create project.
- Use Postgres dump/restore (pg_dump/pg_restore) for data transfer.

## UI/UX States

- N/A

## Edge Cases

- Large data volumes; need to ensure pg_restore completes.
- Auth users or storage data not included by default.

## Testing Strategy

- Verify row counts for critical tables.
- Spot-check sample records.

## Rollout

- N/A (non-user-facing infra task).

## DB Change Plan (if applicable)

- Target envs: production (source) → pre-staging (target)
- Backup reference: record dump file location in artifacts
- Dry-run evidence: artifacts/db-diff.txt (if schema diff needed)
- Backfill strategy: N/A (full restore)
- Rollback plan: delete target project if incorrect

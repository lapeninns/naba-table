---
task: nabatable-pre-staging-db-clone
timestamp_utc: 2026-01-22T12:45:16Z
owner: github:@maintainers
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm org and region
- [x] Create new Supabase project `nabatable-pre-staging`

## Core

- [x] Export production database
- [x] Import into pre-staging database (pooler host; schema-only + data-only with session_replication_role=replica)
- [x] Verify row counts / spot checks (see artifacts)
- [x] Copy auth users (auth schema data-only import)
- [x] Copy storage buckets/objects (0 buckets/objects in prod)

## Notes

- Assumptions: DB data only unless auth/storage explicitly requested
- Deviations:
  - Direct host `db.<ref>.supabase.co` had no DNS record; used pooler host for restore.
  - Orphaned FK in prod (`allocations.booking_id`) caused constraint validation failure; restored schema first, then loaded data with `session_replication_role=replica` to preserve snapshot.
  - Auth table truncation cascaded to public tables; reloaded public data from dump afterward.

## Batched Questions

- Include auth users and storage objects?

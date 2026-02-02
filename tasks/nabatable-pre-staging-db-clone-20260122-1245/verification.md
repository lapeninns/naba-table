---
task: nabatable-pre-staging-db-clone
timestamp_utc: 2026-01-22T12:45:16Z
owner: github:@maintainers
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- N/A (no UI changes)

## Test Outcomes

- [x] Data verification checks recorded
  - Snapshot time: 2026-01-22 14:19:11 (from dump filename)
  - Row counts (prod vs staging):
    - restaurants: 3 vs 3
    - bookings: 239 vs 239
    - allocations: 191 vs 192 (staging reflects snapshot; prod likely changed post-dump)
    - customers: 227 vs 227
    - table_inventory: 64 vs 64
  - Auth users: 10 vs 10
  - Storage buckets/objects: 0 vs 0

## Artifacts

- Dump file: archived outside repo during cleanup (see ops backup storage).
- Restore logs:
  - `artifacts/pg_restore_pooler.log` (pooler restore attempt; DNS issue on direct host)
  - `artifacts/pg_restore_pooler_filtered.log` (event trigger filtering attempt)
  - `artifacts/pg_restore_pooler_filtered_noclean.log` (constraint validation failure)
  - `artifacts/pg_restore_schema_only.log` (schema restore)
  - `artifacts/psql_data_load_replica.log` (data load with replication_role)
  - `artifacts/psql_data_reload_after_auth.log` (public data reload after auth copy)
- Restore lists:
  - `artifacts/pg_restore.list`
  - `artifacts/pg_restore.filtered.list`
- Verification counts:
  - `artifacts/counts_prod.csv`
  - `artifacts/counts_staging.csv`
  - `artifacts/auth_storage_counts_prod.csv`
  - `artifacts/auth_storage_counts_staging.csv`
  - `artifacts/auth_dump_path.txt`

## Known Issues

- [ ] Direct host `db.loxrwkeuxesctnrdpksy.supabase.co` has no DNS record; restore used pooler host.
- [ ] Orphaned FK in production: `allocations.booking_id` references missing booking; required data load with `session_replication_role=replica` to preserve snapshot.
- [ ] Auth users copied; storage buckets/objects empty in production (0).
- [ ] Auth truncation cascaded to public tables; reloaded public data from dump to restore.

## Sign-off

- [ ] Engineering

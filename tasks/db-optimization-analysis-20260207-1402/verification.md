---
task: db-optimization-analysis
timestamp_utc: 2026-02-07T14:02:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Data Collection (Staging)

- Target: Supabase project `ndxmivcrehsacuerwxtm` (staging).
- Tooling: `supabase` CLI + Postgres client queries.

## Artifacts

- See `artifacts/` for collected outputs (sanitized; no secrets).

### Collected (2026-02-07 UTC)

- Snapshot:
  - `artifacts/staging_db_diagnostics.txt`
  - `artifacts/pg_stat_activity_snapshot.csv`
  - `artifacts/pg_lock_waits_snapshot.csv`
- Query stats:
  - `artifacts/pg_stat_statements_top_mean.csv`
  - `artifacts/pg_stat_statements_top_total.csv`
  - `artifacts/pg_stat_statements_top_calls.csv`
  - `artifacts/pg_stat_statements_oltp_top_mean.csv`
  - `artifacts/pg_stat_statements_oltp_top_total.csv`
  - `artifacts/pg_stat_statements_oltp_top_calls.csv`
- Table scans:
  - `artifacts/table_scan_stats_public.csv`
- Index audit:
  - `artifacts/index_usage_public.csv`
  - `artifacts/index_unused_public.csv`
  - `artifacts/index_duplicates_public.csv`
  - `artifacts/index_duplicates_ignoring_uniqueness_public.csv`
  - `artifacts/fk_missing_indexes_public.csv`
- Schema:
  - `artifacts/public_schema_dump.sql`
  - `artifacts/public_table_schema_summary.csv`
  - `artifacts/public_constraints_summary.csv`
- Security:
  - `artifacts/table_grants_public.csv`
  - `artifacts/rls_policies_public.csv`
  - `artifacts/rls_policies_role_public.csv`
  - `artifacts/rls_policies_role_public_risky.csv`
  - `artifacts/roles.csv`
- Config / WAL / logging:
  - `artifacts/wal_backup_logging_settings.csv`
  - `artifacts/observability_settings.csv`
  - `artifacts/supabase_postgres_config_overrides.json`

## Notes

- Staging database is small; `pg_stat_statements` is dominated by utility/maintenance queries. Use a production-like dataset/workload replay to validate performance impacts before production changes.
- The artifacts in this task were collected before the later staging hardening migrations in this branch. See `report.md` for the current state and post-change spot checks.

---
task: staging-perf-dataset
timestamp_utc: 2026-02-07T16:47:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Staging Safety

- Target staging project ref: `ndxmivcrehsacuerwxtm`.
- Script guardrails:
  - dry-run by default
  - `--apply` required for writes
  - seed-only slug prefix and reference prefix

## Results

- Seed restaurants created: 50
- Customers created: 12,500
- Bookings created: 16,500
- Assignments created: 6,665

## Workload Replay (Representative Queries)

- Seed booking window (from `artifacts/workload-timings.json`): 2026-01-24 → 2026-02-14
- Simplified ops workload timings (mean, worst chunk p95):
  - `ops_bookings_list_range`: ~65ms mean, ~154ms p95
  - `ops_bookings_list_search`: ~70ms mean, ~172ms p95
  - `ops_today_summary`: ~86ms mean, ~275ms p95

## Artifacts

- Seed run summary: `artifacts/seed-summary.json`
- Workload timings: `artifacts/workload-timings.json`
- Post-run `pg_stat_statements`:
  - `artifacts/pg_stat_statements_top_total.csv`
  - `artifacts/pg_stat_statements_top_mean.csv`
  - `artifacts/pg_stat_statements_top_calls.csv`
- Post-run OLTP-focused `pg_stat_statements` (filters out realtime/WAL noise):
  - `artifacts/pg_stat_statements_oltp_top_total.csv`
  - `artifacts/pg_stat_statements_oltp_top_mean.csv`
  - `artifacts/pg_stat_statements_oltp_top_calls.csv`
- Post-run OLTP SELECT-only `pg_stat_statements` (best starting point for read-path tuning):
  - `artifacts/pg_stat_statements_oltp_select_top_total.csv`
  - `artifacts/pg_stat_statements_oltp_select_top_mean.csv`
  - `artifacts/pg_stat_statements_oltp_select_top_calls.csv`
- Post-run sizes/scans/index usage snapshots:
  - `artifacts/table_sizes_public.csv`
  - `artifacts/table_scan_stats_public.csv`
  - `artifacts/index_usage_public.csv`

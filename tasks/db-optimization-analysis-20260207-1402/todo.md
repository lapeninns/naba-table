---
task: db-optimization-analysis
timestamp_utc: 2026-02-07T14:02:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Analysis

- [x] Link Supabase CLI to staging project.
- [x] Collect baseline DB metadata (version, settings, sizes, extensions).
- [x] Collect query stats (pg_stat_statements) and identify slow queries.
- [x] Audit indexes (usage, duplicates, missing FK indexes).
- [x] Review schema design and constraints.
- [x] Review RLS + grants.
- [x] Review autovacuum/maintenance health.

## Deliverables

- [x] Executive summary + prioritized recommendations.
- [x] Detailed findings by category.
- [x] Cost/benefit + risk assessment for major changes.
- [x] Roadmap with effort estimates.

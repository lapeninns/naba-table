---
task: supabase-baseline-migrations-runbook
timestamp_utc: 2026-02-07T15:50:18Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Commands Run

- `bash scripts/supabase/check_migration_versions_unique.sh`
- `bash scripts/supabase/repair_migration_history_linked.sh --dry-run`
- `supabase migration list --linked`
- `supabase db push --linked --dry-run`

## Results

- `bash scripts/supabase/check_migration_versions_unique.sh`
  - PASS (migration versions are unique).
- `bash scripts/supabase/repair_migration_history_linked.sh --dry-run --through 20260207144113`
  - PASS (prints expected versions without modifying remote).
- `supabase migration list --linked`
  - PASS (local versions match remote versions 1:1).
- `supabase db push --linked --dry-run`
  - PASS (remote reports "up to date"; no replay of historical migrations).

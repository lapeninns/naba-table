---
task: prod-db-rollout
timestamp_utc: 2026-02-08T00:24:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Pre-flight Evidence

- Unique migration versions:
  - `scripts/supabase/check_migration_versions_unique.sh` => OK
- Linked project ref:
  - `supabase/.temp/project-ref` => `vrdiqfudmwydclqpydee`

## Baseline (Option A)

- Baseline cutoff: `20260206213430`
- Evidence:
  - `artifacts/baseline-dry-run.txt`
  - `artifacts/baseline-apply.txt`
  - `artifacts/migration-list-after-baseline.txt`
  - `artifacts/remote-only-applied-versions.txt`
  - `artifacts/remote-only-revert-apply.txt`
  - `artifacts/migration-list-after-reverting-remote-only.txt`

## Apply

- Dry-run plan:
  - `artifacts/db-push-dry-run-after-reconcile.txt`
- Apply output:
  - `artifacts/db-push-apply.txt`
  - Notes:
    - Policy drop notices were expected (`DROP POLICY IF EXISTS ...`).
    - Index creation used `IF NOT EXISTS`; one index already existed in prod and was skipped safely.

## Post-flight

- `supabase db push --linked --dry-run` => up to date
- Evidence:
  - `artifacts/migration-list-final.txt`
  - `artifacts/db-push-final-dry-run.txt`

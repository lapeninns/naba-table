---
task: auto-zone-adjacency
timestamp_utc: 2026-02-08T18:00:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Local Tests

- [x] `pnpm lint` (passes; warnings only)
- [x] `pnpm typecheck`
- [x] `pnpm -s vitest run`

## DB Verification

- [x] Run read-only adjacency verification script against staging
- [ ] Run read-only adjacency verification script against production

Artifacts:
`tasks/auto-zone-adjacency-20260208-1800/artifacts/adjacency-verification-staging.json`

### Notes / Blockers

- Staging migration applied via direct Postgres connection (shared pooler) using a chunked apply to avoid
  transition-table constraints. Verification artifact captured above.
- Supabase CLI `db push` is not currently usable against production due to remote migration history drift
  (remote has versions not present locally, and local has versions the CLI wants inserted). The migration SQL
  is idempotent; the next safe step is to apply it via a direct Postgres connection using
  `scripts/apply-sql-file.ts`, then verify with `scripts/verify-zone-adjacencies.ts`.

## Rollback Steps (DB)

1. Drop triggers on `public.table_inventory` and `public.zones`.
2. Drop trigger functions.
3. Keep `public.table_adjacencies` table and data.
4. If needed, disable RLS on `public.table_adjacencies`.

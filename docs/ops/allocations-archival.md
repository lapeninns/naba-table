# Allocations Archival & Pruner

## Purpose

The `allocations` table accumulates every hold/assignment window and grows quickly. Instead of partitioning (blocked by the unique + exclusion constraints), we archive historical rows after their window closes and keep only the recent horizon (default 30 days) online.

## Components

- `public.allocations_archive` — stores historical allocations with the same schema plus `archived_at`.
- `public.prune_allocations_history(cutoff, limit)` — RPC used by the pruner job; moves rows and deletes originals atomically.
- `server/jobs/allocations-pruner.ts` + CLI `pnpm jobs:allocations-pruner` — runs the RPC in batches and emits `allocations.pruner.run` events.
- Env knobs:
  - `ALLOCATIONS_RETENTION_DAYS` (default **30**)
  - `FEATURE_MANUAL_ASSIGNMENT_MAX_SLACK` (controls manual slack budget; documented elsewhere but referenced here for ops completeness).

## Running the Pruner

```
pnpm jobs:allocations-pruner
```

Schedule via cron/worker every 5–10 minutes. Example cron (UTC):

```
*/5 * * * * cd /app && pnpm jobs:allocations-pruner >> logs/allocations-pruner.log 2>&1
```

## Monitoring

- Check `allocations.pruner.run` events (total archived/deleted, duration, iterations).
- Alert if `totalArchived` stays `0` for >24h (job not running) or spikes unexpectedly.
- Use Supabase metrics to monitor `allocations_archive` size for retention validation.

## Recovery / Backfill

- The archive table keeps `id` PK so rows can be reinserted if needed:
  - `INSERT INTO allocations SELECT * FROM allocations_archive WHERE id = '...'` (ensure window still valid).
- To backfill after deploy: run `pnpm jobs:allocations-pruner` repeatedly until `totalArchived` = 0.

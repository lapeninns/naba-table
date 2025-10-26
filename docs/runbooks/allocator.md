# Allocator Runbook

> Operational checklist for diagnosing Auto/Manual table assignment issues.

## Overview

The allocator manages all manual and automated table assignments through Supabase RPC `assign_tables_atomic_v2`, mirrored `allocations` rows, and short-lived `table_holds`. Manual workflows now call the `/api/staff/manual/*` endpoints which wrap the same primitives. When something degrades we need to confirm Supabase health, release any stale holds, and validate inputs before toggling flags.

- Primary channel: `#ops-alerts`
- Escalation: On-call Engineer → Platform Lead

## Common Alerts & Diagnosis

### 1. Lock contention > threshold

- **Signal**: Alert `allocator.lock_contention` fires when Supabase reports >50 blocked transactions for 3 minutes.
- **Checks**
  1. Confirm Supabase status (`status.supabase.com`).
  2. Run `select * from pg_locks where relation::regclass = 'booking_table_assignments';` on staging replica; capture blockers.
  3. Fetch current manual context `GET /api/staff/manual/context?bookingId=<id>` for the impacted booking to confirm pending hold.
- **Mitigation**
  - Temporarily flip `FEATURE_ALLOCATOR_MERGES_ENABLED=false` (reduces multi-table merges) via environment for the affected environment and redeploy.
  - If locks persist, disable auto allocations via `FEATURE_ALLOCATIONS_DUAL_WRITE=false` and route manual assignment only.
  - Document blocker transactions in runbook notes.

### 2. Hold expiry backlog

- **Signal**: Alert `allocator.hold_expiry_backlog` triggers when >25 holds have `expires_at < now()` for 5 minutes.
- **Checks**
  1. Inspect `select id, booking_id, expires_at from table_holds where expires_at < now()`.
  2. Ensure `holds.sweeper` job running (Cloud Task `table-hold-sweeper`).
- **Mitigation**
  - Manually release holds via new DELETE endpoint:
    ```bash
    curl -X DELETE \
      -H "Authorization: Bearer <service-token>" \
      -H "Content-Type: application/json" \
      https://<env>/api/staff/manual/hold \
      -d '{"holdId":"<uuid>","bookingId":"<booking>"}'
    ```
  - If many holds belong to the same booking, consider forcing confirmation or clearing in database (see SQL snippets below).
  - Verify sweeper job uses `releaseTableHold`; redeploy if missing.

### 3. RPC conflict spikes

- **Signal**: Alert `allocator.rpc_conflict_rate` (>10 conflicts/minute) from telemetry emitted by `emitRpcConflict`.
- **Checks**
  1. Inspect `observability_events` for entries with `source = 'capacity.selector'` or `capacity.hold`.
  2. Correlate with manual validation responses (UI shows badges) and manual context conflict list.
- **Mitigation**
  - Communicate to ops to refresh manual validation before confirming.
  - Flip `FEATURE_ALLOCATOR_REQUIRE_ADJACENCY=true` if adjacency drift is causing conflicts, or temporarily disable merges.
  - If conflicts are due to stale browser state, invalidate caches via Supabase `allocations` cleanup (see SQL).

### 4. Telemetry insert failures

- **Signal**: Alert `allocator.telemetry_insert_failures` from failures in `recordObservabilityEvent` (Loki).
- **Checks**
  - Verify Upstash/redis connectivity for observability service.
  - Ensure event payload size < 1MB.
- **Mitigation**
  - Retry ingestion by re-running `emitHoldCreated/Confirmed` via the manual runbook script (`scripts/replay-allocator-events.ts`).

## Manual Procedures

### Release a specific hold

```sql
-- Inspect hold metadata
select id, booking_id, expires_at, metadata
from table_holds
where id = '<hold-id>';

-- Release (mirrors DELETE endpoint)
select release_table_hold('<hold-id>'::uuid);
```

### Toggle allocator feature flags

| Flag                                  | Location           | Effect                                           |
| ------------------------------------- | ------------------ | ------------------------------------------------ |
| `FEATURE_ALLOCATOR_REQUIRE_ADJACENCY` | Env / `lib/env.ts` | Requires adjacency for manual + auto assignments |
| `FEATURE_ALLOCATOR_MERGES_ENABLED`    | Env / `lib/env.ts` | Enables multi-table merges                       |
| `FEATURE_ALLOCATIONS_DUAL_WRITE`      | Env / `lib/env.ts` | Keeps legacy allocation mirror on                |

Always document flag flips in the task folder & revert once incident resolved.

### Manual context API

- `GET /api/staff/manual/context?bookingId=<uuid>` returns tables, holds, conflicts, assignments used by UI. Call during incidents to verify what the UI sees.
- `DELETE /api/staff/manual/hold` releases a hold (requires `holdId` & `bookingId`).

## Helpful SQL Snippets

```sql
-- Active holds for a booking
select id, table_ids, expires_at
from table_holds
where booking_id = '<booking-id>'
  and expires_at > now();

-- Detect overlapping allocations
select resource_id, count(*)
from allocations
where resource_type = 'table'
  and booking_id = '<booking-id>'
group by resource_id
having count(*) > 1;
```

```sql
-- Recent RPC conflicts
select created_at, context->'error'->>'message' as message
from observability_events
where source = 'capacity.selector'
  and event_type = 'capacity.selector.assignment'
  and context->'error' is not null
order by created_at desc
limit 20;
```

## Aftercare

1. Capture postmortem notes in the relevant task directory.
2. Update alert thresholds if noise observed for >3 consecutive days.
3. Ensure ops team has screenshots or UI steps for manual validation after fixes.

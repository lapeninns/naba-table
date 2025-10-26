# Allocator Alerts

| Alert ID                              | Source                        | Threshold                           | Action                                                                                                           |
| ------------------------------------- | ----------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `allocator.lock_contention`           | Supabase postgres locks       | >50 blocked transactions over 3 min | Follow [Allocator Runbook](../runbooks/allocator.md) §1. Collect `pg_locks` snapshot, consider disabling merges. |
| `allocator.hold_expiry_backlog`       | `table_holds` sweeper         | >25 expired holds pending >5 min    | Use `/api/staff/manual/hold` DELETE to release stuck holds; confirm sweeper job running. See runbook §2.         |
| `allocator.rpc_conflict_rate`         | Telemetry (`emitRpcConflict`) | >10 conflicts/min for 2 min         | Investigate validation warnings, re-run manual validation, toggle adjacency if necessary. Runbook §3.            |
| `allocator.telemetry_insert_failures` | Observability ingest          | >5 failures/5 min                   | Check observability pipeline, replay events. Runbook §4.                                                         |

## Dashboard Widgets

- **Hold backlog:** `select count(*) from table_holds where expires_at < now()`
- **RPC conflicts:** Grafana panel `Allocator / RPC Conflicts`
- **Lock contention:** Supabase performance page (locks per relation)

## Alert Routing

- Primary: `#ops-alerts`
- Secondary (pager): Ops On-call rotation via PagerDuty (`allocator-service`)

## Escalation

If consecutive alerts persist for >15 minutes without clear mitigation, escalate to Platform Lead and schedule incident call. Document context, commands run, and any flag toggles in the task folder referenced by the alert.

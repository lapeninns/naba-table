# Assignment Pipeline V3 Rollout Runbook

This runbook explains how to graduate the Assignment Pipeline V3 coordinator from documentation-only status to the default booking path. Follow it for **each environment** (dev/staging/production) so we build confidence with real telemetry before deleting the legacy planner loop in `server/jobs/auto-assign.ts`.

## Flag Matrix (per environment)

| Stage                         | FEATURE_ASSIGNMENT_PIPELINE_V3 | FEATURE_ASSIGNMENT_PIPELINE_V3_SHADOW | FEATURE_ASSIGNMENT_PIPELINE_V3_MAX_PARALLEL                            | Notes                                                                                                                                                   |
| ----------------------------- | ------------------------------ | ------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local dev (baseline)          | `false`                        | `false`                               | `3`                                                                    | Keep disabled unless you are actively exercising the coordinator.                                                                                       |
| Staging — Phase 1 (shadow)    | `false`                        | `true`                                | `3`                                                                    | Coordinator stays off the hot path but flags make intent explicit. Capture telemetry manually (e.g., run `scripts/ops-auto-assign-ultra-fast-loop.ts`). |
| Staging — Phase 2 (full)      | `true`                         | `false`                               | `3`                                                                    | Booking jobs route through `AssignmentCoordinator`. Watch `assignment.coordinator.*` events for ≥48h.                                                   |
| Production — Phase 1 (shadow) | `false`                        | `true`                                | `3`                                                                    | Mirror staging once it stabilises; no user-facing impact yet.                                                                                           |
| Production — Phase 2 (full)   | `true`                         | `false`                               | Start with `3`, raise to `5` only after success/error ratio stays >97% | Roll out during a staffed window with rollback plan ready.                                                                                              |

> ⚠️ `_SHADOW=true` currently documents intent only; the coordinator still stays idle until `_V3=true`. The shadow phase is still valuable as an explicit checklist item and ensures infra/CI picks up the pending change.

## Rollout Checklist (per environment)

1. **Enable shadow mode**
   1. Update the env store (e.g., Vercel/Supabase secrets) with `FEATURE_ASSIGNMENT_PIPELINE_V3=false` and `FEATURE_ASSIGNMENT_PIPELINE_V3_SHADOW=true`.
   2. Deploy and verify the app still routes bookings via the legacy loop (look for `auto_assign.attempt.start` events only).
   3. Run the coordinator manually on sample bookings if desired and capture notes in the task folder.
2. **Flip to full mode** (once metrics look healthy)
   1. Set `FEATURE_ASSIGNMENT_PIPELINE_V3=true`, `FEATURE_ASSIGNMENT_PIPELINE_V3_SHADOW=false`, and keep `FEATURE_ASSIGNMENT_PIPELINE_V3_MAX_PARALLEL=3`.
   2. Redeploy. Confirm background logs show `coordinator.*` entries in addition to `assignment.state_machine` transitions.
   3. Monitor success/error rates using the SQL below for at least 48h.
3. **Scale concurrency** (optional)
   1. Increase `_MAX_PARALLEL` by 1 at a time (max 10) if restaurants report backlog. Each bump requires another short soak + observability review.
4. **Regression-free confirmation**
   1. Once success ≥97% and manual_review <1% sustained, document the findings in `tasks/assignment-pipeline-v3-rollout-*/verification.md`.
   2. File/execute the follow-up task to delete the legacy planner loop (see “Cleanup plan”).

## Observability Queries

Run these against the Supabase database (read-only replica is fine):

```sql
-- Success/error ratio (last 6 hours)
select event_type,
       count(*)                                                      as total,
       count(*) filter (where context->>'reason' is null)            as successes,
       count(*) filter (where context->>'reason' is not null)        as failures
from observability_events
where source in ('assignment.coordinator', 'assignment.state_machine')
  and created_at >= now() - interval '6 hours'
group by 1
order by 1;
```

```sql
-- Retry reasons + delays (helpful during tuning)
select context->>'reason'  as reason,
       avg((context->>'delay_ms')::numeric) as avg_delay_ms,
       count(*)
from observability_events
where source = 'assignment.coordinator'
  and event_type = 'coordinator.retry'
  and created_at >= now() - interval '24 hours'
group by 1
order by count(*) desc;
```

```sql
-- Manual review rate vs restaurant
select restaurant_id,
       count(*) filter (where event_type = 'coordinator.manual_review') as manual_reviews,
       count(*) filter (where event_type = 'coordinator.confirmed')     as confirmed,
       round(
         100 * count(*) filter (where event_type = 'coordinator.manual_review')::numeric /
         nullif(count(*) filter (where event_type = 'coordinator.confirmed'), 0),
         2
       ) as percent_manual
from observability_events
where source = 'assignment.coordinator'
  and created_at >= now() - interval '24 hours'
group by 1
order by manual_reviews desc;
```

### Event Cheat Sheet

| Event Type                    | When it fires                     | Action                                                    |
| ----------------------------- | --------------------------------- | --------------------------------------------------------- |
| `coordinator.start`           | Every invocation; includes `mode` | Expect one per booking.                                   |
| `coordinator.lock_contention` | Lock miss                         | Investigate long-running jobs.                            |
| `coordinator.circuit_open`    | Circuit breaker trip              | Check upstream services.                                  |
| `coordinator.confirmed`       | Assignment confirmed              | Primary success metric.                                   |
| `coordinator.retry`           | Backoff scheduled                 | Inspect `reason` (`rate_limited`, `no_assignment`, etc.). |
| `coordinator.manual_review`   | Pipeline escalated booking        | Ensure ops workflow is ready.                             |
| `coordinator.error`           | Unexpected exception              | Page on-call, flip flag off if sustained.                 |

`assignment.state_machine` events continue to log every transition and should be co-monitored to ensure bookings march through CREATED → CAPACITY_VERIFIED → … → CONFIRMED.

## Rollback Plan

1. Flip `FEATURE_ASSIGNMENT_PIPELINE_V3=false` (leave `_SHADOW=false`).
2. Redeploy; confirm auto-assign job resumes legacy planner loop (`auto_assign.attempt.start` logs reappear).
3. Leave `assignment.coordinator` telemetry on for 30 minutes to ensure no straggling jobs emit events.
4. File an incident note referencing the relevant SQL output.

## Legacy Planner Cleanup Scope

Once production has run in full mode for at least a week without elevated manual-review/retry rates, delete:

- The legacy attempt loop inside `server/jobs/auto-assign.ts` (`while (attempt < maxAttempts)` block plus related helpers such as planner cache adjustments).
- Planner-specific observability events under the `auto_assign.*` namespace that only exist for the legacy path.
- Any unused helpers under `server/capacity/planner-*` that become unreachable.

Keep `AssignmentCoordinator`, state machine tables, and outbox integrations intact; only remove the redundant legacy flow.

## References

- `server/assignments/assignment-coordinator.ts` — coordinator orchestration + new telemetry.
- `server/assignments/state-machine.ts` — emits `assignment.state_machine` events per transition.
- `.env.example` — default values + inline rollout guidance.
- Task folder: `tasks/assignment-pipeline-v3-rollout-20251113-0932/` (research, plan, verification).

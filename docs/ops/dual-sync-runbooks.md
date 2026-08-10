# Dual-Sync Operator Runbooks

These runbooks cover Google Business Profile dual-sync after the production-safety hardening rollout. They are operational procedures, not approval to run production changes.

## Scope

- Shipped ops route: `app.localhost:3000/settings/restaurant/google-business-profile`.
- Primary APIs:
  - `POST /api/ops/restaurants/:id/dual-sync/refresh`
  - `POST /api/ops/restaurants/:id/dual-sync/publish/preview`
  - `POST /api/ops/restaurants/:id/dual-sync/publish`
  - `GET /api/ops/restaurants/:id/dual-sync/jobs`
  - `POST /api/ops/restaurants/:id/dual-sync/jobs/:jobId/retry`
  - `GET/PATCH /api/ops/restaurants/:id/dual-sync/control`
  - `GET /api/cron/dual-sync/queue`
  - `GET /api/cron/dual-sync/health`
  - `GET /api/cron/dual-sync/request-log-retention`
- Durable tables:
  - `dual_sync_locks`
  - `dual_sync_publish_batches`
  - `dual_sync_publish_operation_groups`
  - `dual_sync_publish_operations`
  - `dual_sync_jobs`
  - `dual_sync_restaurant_controls`
  - `dual_sync_google_edit_reservations`
  - `dual_sync_google_request_logs`
  - `observability_events`

## Safety Rules

- Start with read-only inspection.
- Use staging first for migrations, scheduler changes, destructive cleanup, or replay drills.
- Do not trigger live Google writes while diagnosing unless a named venue, exact decision set, and approval are recorded.
- Treat `service_role` database access as production-sensitive. Do not paste secrets into logs or artifacts.
- If route proof is blocked by auth, record the auth boundary exactly instead of claiming UI verification.

## Reauth Required

Symptoms:

- Publish failure code `REAUTH_REQUIRED`.
- Google connection state shows `needs_reauth` or `reauth_required`.
- Refresh or publish fails after token refresh.

Inspect:

```sql
select id, restaurant_id, provider, connection_status, updated_at
from restaurant_external_profiles
where restaurant_id = '<restaurant_id>'
  and provider = 'google_business_profile';
```

Operator action:

- Ask an authorized venue admin to reconnect Google from the Google Business Profile settings route.
- After reconnect, run a manual Google refresh before publishing.
- Confirm dual-sync state recomputes and the same field decisions still pass preview.

Do not:

- Manually edit OAuth tokens.
- Retry publish repeatedly while credentials are invalid.

## Queue Drain Failure

Symptoms:

- `/api/cron/dual-sync/queue` returns 500.
- `observability_events` has `source = 'cron.dual-sync.queue'` and `event_type = 'drain.failed'`.
- Jobs remain `queued` or `retrying` after the expected drain interval.

Inspect:

```sql
select event_type, severity, context, created_at
from observability_events
where source = 'cron.dual-sync.queue'
order by created_at desc
limit 20;

select status, job_kind, count(*)
from dual_sync_jobs
where provider = 'google_business_profile'
group by status, job_kind
order by status, job_kind;
```

Operator action:

- Run the queue cron with `dryRun=1` in the target environment to verify auth and cap parsing without claiming jobs.
- If dry-run succeeds, run one low cap drain such as `maxJobs=1` and inspect the result payload.
- If jobs immediately retry or dead-letter, switch to the relevant failure-code runbook below.

Do not:

- Increase `maxJobs` during an active failure.
- Bypass cron auth.

## Operational Health Alerts

Symptoms:

- `DUAL_SYNC_FAILURE_WEBHOOK_URL` receives `operational_health_alert`.
- `/api/cron/dual-sync/health` returns `alertsEmitted > 0`.
- `observability_events` has `source = 'dual-sync.operational-health'` and
  `event_type = 'alert.emitted'`.

Inspect:

```sql
select restaurant_id, severity, context, created_at
from observability_events
where source = 'dual-sync.operational-health'
order by created_at desc
limit 50;
```

Operator action:

- Run `/api/cron/dual-sync/health?dryRun=1&onlyCritical=1` in the target
  environment to inspect critical alerts without emitting notifications.
- Open the shipped operational health panel for the affected restaurant.
- Route to the specific runbook named by the alert code:
  `DEAD_LETTER_JOBS`, `QUOTA_LIMITED`, `REAUTH_REQUIRED`,
  `STALE_DECISIONS`, or `PARTIAL_PUBLISH_FAILURES`.
- Confirm a later health dry-run returns no critical alerts before
  closing the incident.

Do not:

- Disable the webhook to quiet repeated alerts without fixing the
  underlying health condition.
- Retry queue jobs before reading their last error code and payload.

## Google Request Log Retention

Symptoms:

- `dual_sync_google_request_logs` rows pass their `retention_expires_at`.
- `/api/cron/dual-sync/request-log-retention` returns 500.
- `observability_events` has `source = 'cron.dual-sync.request-log-retention'`
  and `event_type = 'retention.failed'`.

Inspect:

```sql
select count(*) as expired
from dual_sync_google_request_logs
where retention_expires_at < timezone('utc', now());

select event_type, severity, context, created_at
from observability_events
where source = 'cron.dual-sync.request-log-retention'
order by created_at desc
limit 20;
```

Operator action:

- Run the retention cron with `dryRun=1` first to verify auth and limit parsing
  without deleting rows.
- If dry-run succeeds and the request-log migration exists in the target
  environment, run a low cap such as `limit=100`. Retention first copies the
  selected rows into `dual_sync_google_request_log_archives`, then deletes only
  those archived ids from the hot request-log table.
- Increase the cap only after confirming the completed event reports expected
  `selected`, `archived`, and `deleted` counts.

Do not:

- Run retention before the request-log migration is applied and read back.
- Delete request-log rows manually while investigating a publish incident.
- Include request or response payloads in incident notes; use counts, ids, and
  failure codes instead.

## Dead-Letter Job Retry

Symptoms:

- Queue panel shows `dead_letter`.
- `dual_sync_jobs.status = 'dead_letter'`.

Inspect:

```sql
select id, restaurant_id, job_kind, attempt_count, max_attempts,
       last_error_code, last_error_message, dead_letter_reason,
       payload, finished_at
from dual_sync_jobs
where status = 'dead_letter'
order by finished_at desc
limit 50;
```

Operator action:

- Read the payload and error before retry.
- Fix the root cause first: reauth, quota wait, stale decision, unsupported field, migration mismatch, or route bug.
- Retry from the shipped queue recovery panel or `POST /api/ops/restaurants/:id/dual-sync/jobs/:jobId/retry`.
- Confirm the retried job moves to `queued`, then `running`, then `succeeded` or a new actionable failure.

Do not:

- Retry a dead-letter job with stale publish hashes unless the preview is rerun.
- Directly mutate `attempt_count` or `status` in production unless there is an approved incident procedure.

## Google Quota Limited

Symptoms:

- Publish failure code `QUOTA_LIMITED`.
- Queue job last error is `QUOTA_LIMITED`.
- Recent rows exist in `dual_sync_google_edit_reservations`.

Inspect:

```sql
select restaurant_id, write_group, reserved_at, window_ms
from dual_sync_google_edit_reservations
where restaurant_id = '<restaurant_id>'
order by reserved_at desc
limit 20;
```

Operator action:

- Wait for the reported retry window.
- Prefer queued retry over manual repeated publish.
- If multiple venues are affected, reduce queue drain `maxJobs` until quota failures stop.
- Confirm retries are spaced by `available_at` rather than immediately looping.

Do not:

- Delete reservation rows to force more writes.
- Split a section-level publish into many field-level writes to bypass the budget.

## Stale Decision

Symptoms:

- Publish preview or publish returns `CORE_DRIFT` or `GBP_DRIFT`.
- Operator sees a field change between preview and confirm.

Operator action:

- Refresh from Google.
- Reopen the publish preview.
- Reconfirm only the accepted decisions from the new plan.
- If stale errors repeat, inspect for concurrent scheduled refresh or core-write recompute jobs.

Inspect:

```sql
select id, job_kind, status, payload, started_at, finished_at
from dual_sync_jobs
where restaurant_id = '<restaurant_id>'
order by created_at desc
  limit 25;
```

## Restaurant Sync Paused

Symptoms:

- Workspace shows `Paused`.
- Publish preview rejects decisions with `SYNC_PAUSED`.
- Publish, refresh, auto-export, or queued jobs fail with `DUAL_SYNC_RESTAURANT_PAUSED`.

Inspect:

```sql
select restaurant_id, provider, sync_paused, pause_reason,
       paused_by_user_id, paused_at, resumed_at, updated_at
from dual_sync_restaurant_controls
where restaurant_id = '<restaurant_id>'
  and provider = 'google_business_profile';
```

Operator action:

- Pause from the shipped Google Business Profile sync workspace before maintenance, suspected bad Google state, incident triage, or production rollout rollback.
- Leave the workspace readable while paused; use state, jobs, operations, and health panels for diagnosis.
- Resume only after the root cause is fixed and a fresh preview/refresh path is ready.

Do not:

- Delete queue jobs just because a restaurant is paused.
- Resume and immediately replay stale publish payloads; rerun preview first.

## Provider Preflight Unsupported

Symptoms:

- `dual_sync_publish_operation_groups.preflight_result` contains
  `preflightUnsupported: true`.
- The affected group is `location.attributes` or `location.foodMenus`.

Meaning:

- This is not an automatic failure. It records that the current Google
  endpoint exposes a mask strategy but no `validateOnly` parameter for
  that write group.
- Attributes must use `attributeMask` and only supported attribute IDs.
- FoodMenus must use `updateMask = menus`, fresh baseline-hash preflight,
  and high-risk confirmation because Google replaces the menu resource.

Operator action:

- For attributes, verify the attribute appears in Google-supported
  attribute metadata for the venue category/country before retry.
- For FoodMenus, verify the latest Google baseline hash and Nabatable
  projection hash still match the reviewed preview before retry.
- If Google returns validation failure anyway, treat the stable failure code
  as the source of truth and rerun preview after correcting the payload.

Do not:

- Treat `preflightUnsupported: true` as permission to bypass preview,
  masks, queueing, throttle, or audit.
- Retry FoodMenus without a fresh preview when either baseline hash changed.

## Partial Publish Failure

Symptoms:

- Publish result has both succeeded and failed operations.
- Operation group status is `failed` or `retrying`.

Inspect:

```sql
select id, status, section_key, write_group, google_update_masks,
       preflight_status, error_code, error_message
from dual_sync_publish_operation_groups
where publish_batch_id = '<publish_batch_id>'
order by created_at asc;

select field_key, direction, status, before_core_hash, before_gbp_hash,
       after_core_hash, after_gbp_hash, google_update_mask,
       error_code, error_message
from dual_sync_publish_operations
where publish_batch_id = '<publish_batch_id>'
order by created_at asc;
```

Operator action:

- Do not assume the whole section succeeded.
- Refresh from Google to recompute actual state.
- Retry only failed, still-drifted fields through a new preview.
- If Google accepted a partial resource write, attach the operation group and operation rows to the incident note.

## Pending Candidate Cancellation

Use this when a Core-side change was captured as an outbound candidate, but the operator decides it should not be exported to Google.

Preferred operator path:

- Open the Google Business Profile sync workspace.
- Expand `Pending changes`.
- Use `Cancel` on the specific open candidate.
- Refresh the workspace and verify the candidate count drops.

API fallback:

```text
POST /api/ops/restaurants/:restaurantId/dual-sync/candidates/:candidateId/cancel
```

Safety expectations:

- The route requires restaurant admin access.
- The update is scoped by candidate id, restaurant id, provider, and `status = open`.
- The row is not deleted; status changes to `cancelled` and `resolved_at` is recorded.
- A candidate from another restaurant, or an already resolved/superseded/cancelled row, returns not cancellable.

Do not:

- Delete candidate rows during normal recovery.
- Cancel a candidate to hide a publish failure; use publish operation and job history for that.
- Bulk-cancel candidates without first confirming which Core changes should remain local-only.

## Rollback

Rollback depends on what changed.

- UI-only deploy: revert the application deployment.
- Scheduler config: disable or lower the dual-sync queue cron first; then redeploy config.
- The dual-sync API surface and settings workspace are default-on; use the targeted controls below for rollback.
- Import rollback: set `GBP_IMPORT_ENABLED=false` to reject import decisions before Core writes.
- Export rollback: set `GBP_EXPORT_ENABLED=false` to reject export decisions before operation rows or Google writes.
- High-risk rollback: set `GBP_HIGH_RISK_EXPORTS_ENABLED=false` to reject high-risk/manual-review exports while keeping lower-risk exports available.
- Auto-candidate rollback: set `GBP_AUTO_CANDIDATES_ENABLED=false` to disable manual and scheduled candidate export drains.
- Section rollback: set `GBP_MENU_SYNC_ENABLED=false` or `GBP_ATTRIBUTES_SYNC_ENABLED=false` to block FoodMenus or attribute decisions.
- Scheduled refresh rollback: set `GBP_SCHEDULED_REFRESH_ENABLED=false` to stop cross-tenant scheduled Google refresh while leaving manual operator refresh available.
- Restaurant-level rollback: pause the affected restaurant from the dual-sync workspace or `PATCH /api/ops/restaurants/:id/dual-sync/control` with `syncPaused=true`; use this before broader global flags when the incident is venue-local.
- Migration not yet applied to production: do not apply it until staging proof is complete.
- Migration already applied to production: do not drop tables during an incident. Disable write paths or feature flags first, preserve audit rows, then plan a reversible data migration.
- Google publish error: refresh from Google and use a new reviewed publish in the opposite direction only if the operator can verify the desired final value.

Required incident note:

- Environment.
- Restaurant id and venue name.
- Publish batch id or queue job id.
- Exact failure code.
- Whether Google was written.
- Whether Core was written.
- Rollback action taken.
- Follow-up owner.

## Production Rollout, Canary, and Rollback Gate

This procedure requires separate staging and production evidence. The source defaults are
write-safe: `GBP_WRITE_ROLLOUT_MODE=off`, import/export/high-risk/menu/attributes/scheduled
refresh/PubSub ingestion are false by default. `GBP_AUTO_CANDIDATES_ENABLED` is an exception
and defaults true, so a rollback must set it explicitly false rather than relying on omission.

Before setting a canary, capture a count-only readback of the write-grant and rollout state.
The proposed canary venue must be the only venue in the readback and must have no unresolved
grant, queue, or terminal-notice incident. Do not use a live customer venue unless the
change approval identifies it.

Canary set, readback, and restore have two exact rollout grants plus the deployment gate:

1. The deployment configuration must set `GBP_WRITE_ROLLOUT_MODE=canary` and set
   `GBP_CANARY_RESTAURANT_ID` to the same, recorded restaurant UUID. The environment schema
   rejects canary mode without that UUID.
2. The remote database must read back `gbp_write_rollout_config_v1.rollout_mode = canary`
   and exactly one enabled row in `gbp_write_canary_restaurants_v1` for that restaurant.
   These are the two remote authorization records: the global mode row and the venue row.
3. Read back both deployment configuration and the two remote records before the first
   approved write. Record only the restaurant UUID, row counts, timestamps, command names,
   and an artifact digest; never record credentials, tokens, payloads, or guest data.
4. Restore by setting the deployment rollout mode to `off`, removing or disabling the canary
   row, and reading back `off` plus zero enabled canary rows. A restored deployment is not
   proven safe until both configuration planes agree.

The first canary write must use one named venue, one reviewed preview, and the exact current
grant bundle. A grant is scoped to its ordered group, request/decision/update-mask hashes,
connection generation, consent epoch, and execution. It is not a reusable approval. Record
the bundle id, grant count, terminal status counts, and hash-only artifact reference; do not
record raw request or provider response content.

For rollback during or after a canary:

1. Stop new public writes first: set `GBP_WRITE_ROLLOUT_MODE=off` and explicitly set
   `GBP_IMPORT_ENABLED=false`, `GBP_EXPORT_ENABLED=false`, `GBP_AUTO_CANDIDATES_ENABLED=false`,
   `GBP_HIGH_RISK_EXPORTS_ENABLED=false`, `GBP_MENU_SYNC_ENABLED=false`,
   `GBP_ATTRIBUTES_SYNC_ENABLED=false`, `GBP_SCHEDULED_REFRESH_ENABLED=false`, and
   `GBP_PUBSUB_INGEST_ENABLED=false` in the target deployment.
2. Pause the affected restaurant before replay or diagnosis. Keep state and audit reads
   available; do not delete jobs, grants, or observations.
3. If application rollback is required, choose the last **permit-aware binary**: the newest
   released binary that understands the exact-consent/claimed-grant persistence contract.
   Do not roll back to a pre-permit binary merely because it predates the incident.
4. Read back the deployed SHA, every disabled flag, rollout mode, paused state, and
   outstanding grant/queue counts. Preserve this evidence before considering the incident
   contained.
5. Resume only after a fresh preview and new approval; stale permits and stale decisions
   must not be replayed.

## Pub/Sub Ingress Release Gate

`/api/webhooks/google-business-profile/pubsub` remains disabled until
`GBP_PUBSUB_INGEST_ENABLED=true` and all four required ingress values are present:
expected audience, push service-account email, subscription, and topic. A production change
must additionally attach external, metadata-only evidence for each item below:

- Topic readback: exact project/topic resource name and the Google Business Profile
  notification registration association.
- Subscription readback: exact subscription resource name, the push endpoint URL, and the
  configured OIDC audience. Do not retain the bearer token.
- DLQ readback: dead-letter topic/subscription identity, max-delivery attempt policy, and the
  operational owner/runbook for replay. A retry policy alone is not a DLQ.
- IAM readback: the Google-managed publisher has publisher permission on the topic; the Pub/Sub
  service agent can publish to the DLQ topic; and the configured push service account has only
  the token-creation/identity permissions needed for the push subscription. Record principal
  names, role names, resource names, and a digest, never service-account keys.
- Ingress proof: an authenticated staging delivery produces a receipt/queue outcome with
  count-only readback; an invalid audience or signer is rejected. Do not use production
  notifications as this test.

## Credential-Key Rotation Dry Run

The keyring needs both `GOOGLE_BUSINESS_TOKEN_ENCRYPTION_ACTIVE_KEY_ID` and
`GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEYS`; the active id must be present in the keyring. Rotate
staging first with both old and new keys present, then run the rotation census in `dryRun`
mode with a bounded limit. The only acceptable dry-run artifact is count-only:
`examined`, `oldKeyCount`, `rewrapped=0`, and `conflicts=0`, plus active key id and an artifact
digest. Never emit an envelope, plaintext, key material, refresh token, or database row.

Only after the dry-run census and a separately approved write window may a bounded compare and
swap rewrap run. Keep the old key available until a post-run census reports `oldKeyCount=0` and
the restoration owner approves its removal.

## Retention, Backup, and PITR Census

Before enabling production writes, record a count-only census from the retention readiness
path: classified-store matched/mutated totals, oldest outstanding age, retention level, and
whether more work is likely. The health cron performs a retention dry run; it is not permission
to perform destructive cleanup.

Record a separate external Supabase backup/PITR artifact that names the target project, backup
status, PITR status/window, most recent successful backup timestamp, restore-test timestamp,
and artifact digest. The checker treats this as an external gate because source and migrations
cannot prove a remote backup policy or restore ability.

## Replay Drill

Use replay before risky code or migration rollout.

- Build a fixture with Core snapshot A, Google snapshot A, expected field states, and expected publish plan.
- Run the pure replay runner for canonical comparison and planning.
- Use the fake Google adapter for mask, validate-only, provider failure, and mutation simulation.
- Keep fixtures free of tokens, personal data, and unredacted customer payloads.

Minimum fixture classes before GA:

- Clean in-sync profile.
- Stale Core decision.
- Stale Google decision.
- High-risk FoodMenus export.
- Attribute validation failure.
- Quota-limited export.
- Reauth-required refresh.
- Partial publish success.

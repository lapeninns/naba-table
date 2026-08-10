# Wave2D runtime gate re-review

recommendation: REJECT

## Original intent and desired outcome

Re-verify the repaired Wave2D implementation end to end, specifically proving that terminal notice retries are idempotent through the real operational transport and that missing-notice reconciliation anti-joins before its limit while remaining atomic under concurrency. The desired user outcome is at-most-one observable operational delivery per terminal notice despite emit-success/finalize-failure/reclaim, plus materialization within the 48-hour SLA.

## User outcome review

The reconciliation starvation repair is confirmed. The runtime calls the committed RPC, the RPC anti-joins notices before ordering/limiting, cron supplies the same `now` and bounded limit, and the PostgreSQL two-session evidence shows exactly one insert. The delivery repair does not establish end-to-end idempotency: it supplies a stable key, but every real bundled transport still performs the side effect on every invocation. The new test and manual driver replace the transport with a `Set`, so uniqueness is created by the fake rather than guaranteed by production.

## Blockers

1. violatedCriterion: `W2D-NOTICE-IDEMPOTENCY`
   evidencePointer: `server/dual-sync/notifications/terminal.ts:126-164`; `server/dual-sync/notifications/console.ts:29-53`; `server/dual-sync/notifications/webhook.ts:26-67`; `server/dual-sync/notifications/index.ts:49-69,86-102`; `tests/server/dual-sync-terminal-notices.test.ts:209-258`; `.omo/evidence/gbp-wave2d-repair-manual.json`
   observation: reclaim invokes `notification.emit` twice with the same key. The console port logs twice. The webhook port merely forwards `idempotency-key`; it has no durable dedupe and accepts arbitrary endpoints that have no contract to honor that header. `combineNotificationPorts` also suppresses errors, and the webhook port resolves successfully even on non-2xx/transport failure, allowing the notice to be finalized as delivered. The repair test's `Set` reports one unique key despite explicitly recording two transport invocations, which is tautological fake behavior and does not prove one real delivery.

## Confirmed repaired behavior

- `server/dual-sync/notifications/terminal.ts:259-275` calls `reconcile_missing_gbp_terminal_notices_v1` with bounded limit and a stable `now`.
- `supabase/migrations/20260809120000_gbp_write_safety_foundation.sql:3564-3600` performs the `LEFT JOIN ... n.id is null` anti-join before `limit p_limit`, locks grants with `skip locked`, and inserts with conflict protection.
- `src/app/api/cron/dual-sync/notifications/route.ts:24-39` binds cron reconciliation and delivery to the same client, limit, and timestamp.
- PostgreSQL artifacts `.omo/evidence/gbp-wave1a-schema-wave2d-reconcile-concurrency-{setup,a,b}.log` show one missing row and exactly one returned insert across two sessions.

## Reproduced checks

- `./node_modules/.bin/vitest run tests/server/dual-sync-terminal-notices.test.ts tests/server/dual-sync-notifications.test.ts tests/server/dual-sync-notifications-cron-route.test.ts tests/server/google-business-profile-notifications-route.test.ts tests/server/gbp-wave1a-schema.test.ts --reporter=dot` — PASS, 5 files/40 tests.
- `./node_modules/.bin/tsc --noEmit --pretty false` — PASS.
- Reviewed `.omo/evidence/gbp-wave2d-repair-focused-green.log`, `.omo/evidence/gbp-wave2d-repair-manual.json`, and the three PostgreSQL concurrency logs.

## Exact evidence gaps

- No production transport owns a durable idempotency ledger or uses a downstream API with a documented/enforced idempotency contract.
- No real transport test demonstrates that two calls with the stable key create one observable delivery.
- No test proves a non-2xx or thrown webhook attempt remains retryable; current transport deliberately swallows both.

## Slop/false-confidence review

The new reclaim test is implementation-mirroring false confidence: `transportInvocations` proves two emits, while a local `Set` is then treated as proof of one delivery. That fake does not model `createConsoleNotificationPort`, `createWebhookNotificationPort`, or any durable downstream idempotency contract. This directly masks the stated success-criterion failure and is blocking.

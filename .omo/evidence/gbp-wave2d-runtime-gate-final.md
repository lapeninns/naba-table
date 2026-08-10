# Wave2D runtime final gate review

recommendation: APPROVE

blockers: []

## Original intent

Ship Wave2D Pub/Sub ingestion, account-scoped notification participation, scheduled/correlated freshness reads, conservative update overlays, and durable terminal user/operational notices with exact authentication, tenant/fence, no-store, idempotency, and 48-hour SLA semantics.

## Desired outcome

Google update messages are authenticated and acknowledged safely, metadata-only receipts atomically deduplicate and enqueue exact-fenced jobs, scheduled refreshes pull location and attributes only, participation preserves unrelated account notification types, and terminal outcomes are materialized and delivered without re-emitting an external action after an ambiguous dispatch or finalize gap.

## User outcome review

CONFIRMED. The prior delivery-idempotency and reconciliation-starvation blockers are repaired. Terminal delivery now persists a unique dispatched attempt before calling the operational transport. Confirmed success, definitive retryable/nonretryable rejection, and ambiguous outcomes map to distinct durable transitions. A stale dispatched attempt becomes `outcome_unknown` and cannot be claimed or emitted again. Missing-notice reconciliation anti-joins before its limit. Pub/Sub, scheduling, exact fences, location/attribute-only refresh, overlays, notification participation, in-app census, no-store headers, telemetry, and singleton cron configuration remain covered by the focused suite and inspected production paths.

## Delivery-state evidence

- `server/dual-sync/notifications/terminal.ts:109-197` recovers stale dispatched attempts before claims, dispatches durably before `emit`, maps typed transport results, and never reclaims ambiguous/finalize-gap attempts.
- `server/dual-sync/notifications/types.ts:26-35,57-59` defines exhaustive confirmed-success, definitive-rejection/retryability, and ambiguous-failure outcomes.
- `server/dual-sync/notifications/console.ts:30-55` and `webhook.ts:30-93` return typed outcomes rather than silently reporting success. HTTP 425/429 are definitive retryable; other definitive 4xx are terminal; 408, 5xx, and thrown transport failures are ambiguous.
- `server/dual-sync/notifications/index.ts:46-86` combines transports using the least-certain outcome.
- `supabase/migrations/20260809120000_gbp_write_safety_foundation.sql:600-684` constrains notice and attempt state; `:3581-3606` claims pending only; `:3704-3732` atomically records dispatch; `:3734-3786` finalizes typed results; `:3788-3813` terminalizes stale dispatched attempts as outcome unknown without requeue.
- `.omo/evidence/gbp-wave2d-truthful-delivery-manual.json` records one transport call across confirmed call, finalize failure, and recovery, ending in `outcome_unknown`.
- `.omo/evidence/gbp-wave1a-schema-wave2d-dispatch-concurrency-{setup,a,b,final}.log` records one successful dispatch, zero rows for the competing session, and one delivery-attempt row.

## Reconciliation and cron evidence

- `server/dual-sync/notifications/terminal.ts:306-322` binds the committed missing-notice RPC.
- SQL `:3609-3646` anti-joins existing notices before ordering/locking/limiting and inserts conflict-safely.
- `src/app/api/cron/dual-sync/notifications/route.ts:24-85` uses one bounded limit/timestamp for reconcile, recover/claim/dispatch/deliver, census, and count-only uncertainty telemetry, returning no-store responses.
- `vercel.json:28-33` contains one refresh cron and one notification cron, each scheduled every 15 minutes.

## Reproduced checks

- Focused Wave2D command covering Pub/Sub routes/parser/persistence, scheduling, overlays/refresh, participation, terminal transports/notices/cron, notification GET route, schema contracts, and cron inventory: PASS — 13 files, 76 tests.
- `./node_modules/.bin/tsc --noEmit --pretty false`: PASS.
- Existing broad evidence `.omo/evidence/gbp-wave2d-truthful-delivery-broad.log`: 96 files, 596 tests passed; inspected as supplementary evidence.
- PostgreSQL dispatch concurrency and manual crash/finalize recovery artifacts inspected and consistent with current SQL/runtime.

## Slop and false-confidence pass

The former `Set`-based fake-idempotency claim is removed. The current manual scenario proves the behavior through the durable state transition: the second run claims zero and performs no second external call. Focused tests cover dispatch-before-emit, typed transport classes, stale-dispatch recovery, and direct RPC bindings. Source-string schema inventory remains supplementary only; approval relies on production-flow inspection, executable runtime tests, and PostgreSQL artifacts. No deletion-only, removal-verification, or newly introduced speculative abstraction blocks a stated criterion.

## Checked artifact paths

- Wave2D production files under `server/dual-sync/{pubsub,notifications,freshness,scheduling}`
- Google notification and connection lifecycle clients/runtime
- Pub/Sub, refresh, notification cron, and restaurant notification routes
- `supabase/migrations/20260809120000_gbp_write_safety_foundation.sql`
- `types/supabase.ts`, `vercel.json`
- focused Wave2D tests and schema contract test
- `.omo/evidence/gbp-wave2d-truthful-delivery-*`
- `.omo/evidence/gbp-wave1a-schema-wave2d-{dispatch,reconcile}-concurrency-*`

## Evidence gaps / notes

- No blocking evidence gap remains. The external webhook endpoint itself is deployment-configured, so its ultimate human presentation is externally unverifiable; the application truthfully distinguishes confirmed, definitive, and ambiguous transport outcomes and exposes uncertainty through in-app state/census rather than claiming delivery or retrying ambiguously.

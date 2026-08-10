# Wave2D runtime gate review

recommendation: REJECT

## Original intent

Ship the approved Wave2D Pub/Sub, account notification participation, scheduled freshness, Google-update overlay, and terminal user-notice behavior end to end, including exact authentication/status contracts, atomic tenant fencing, no FoodMenus reads, safe no-store telemetry, idempotent terminal delivery, and a delivery SLA no longer than 48 hours.

## Desired outcome

Authenticated Google `GOOGLE_UPDATE` pushes are metadata-only and atomically deduplicated/enqueued; account-scoped participation safely preserves unrelated notification types; scheduled and correlated refreshes remain exact-fenced and read location/attributes only; overlays are conservative/display-only for unknown or conflicting paths; every terminal grant produces an in-app/operational notice exactly once or through a safe idempotent retry path within 48 hours.

## User outcome review

Most requested contracts are represented in production code and focused tests. The reproduced focused suite passed 16 files/86 tests, and strict TypeScript checking passed. However, terminal-notice recovery and delivery do not satisfy the user-visible idempotency/SLA outcome under ordinary persistence failures and backlog conditions. These are production-flow defects, not the separately noted Docker concurrency rerun limitation.

## Blockers

1. violatedCriterion: `W2D-NOTICE-IDEMPOTENCY`
   evidencePointer: `server/dual-sync/notifications/terminal.ts:126-163`; `tests/server/dual-sync-terminal-notices.test.ts:108-200`
   observation: `deliverClaimedGoogleWriteNotices` wraps both external emission and delivered-finalization in one `try`. If `notification.emit` succeeds but the delivered `finalize` call fails, the catch path attempts `retryable_failure`; a later lease recovery emits the same operational notice again. No idempotency key is supplied to the notification port, and the tests cover emission failure but not finalization-after-emission failure. This violates the explicit idempotency requirement.

2. violatedCriterion: `W2D-NOTICE-SLA-48H`
   evidencePointer: `server/dual-sync/notifications/terminal.ts:256-311`
   observation: reconciliation selects and limits the oldest terminal grants before excluding grants that already have notices. Once the first `limit` terminal grants all have notices, every cron run reselects those rows and materializes zero, so any newer missing notice beyond that window can remain missing indefinitely and exceed 48 hours. The cron route test mocks reconciliation and does not exercise this query/backlog behavior.

## Notes (non-blocking)

- `enableGoogleUpdateParticipation` mutates Google before attaching the exact-fenced registry (`server/dual-sync/notifications/participation.ts:51-63`), while disable detaches before the provider mutation (`:65-80`). The tests assert calls but not failure compensation or exact ordering. This is a maintenance/consistency risk, but the supplied brief does not state the required transactional compensation semantics precisely enough to add a separate blocker beyond the two proven criteria failures.
- Several schema tests use source-string assertions (`tests/server/gbp-wave1a-schema.test.ts:268-280,516-518`). Those assertions provide inventory confidence only, not behavioral proof. The exact-current schema log reports 18 passing contract checks, but Docker two-session concurrency was not rerun; that limitation is kept separate from the demonstrated runtime bugs.
- The focused tests use narrow mocks for cron and persistence. Their pass count cannot prove recovery behavior. No deletion-only or removal-verification tests were found in the Wave2D focused set.

## Reproduced evidence

- `./node_modules/.bin/vitest run tests/server/google-business-profile-pubsub-route.test.ts tests/server/dual-sync-pubsub.test.ts tests/server/dual-sync-pubsub-persistence.test.ts tests/server/dual-sync-refresh-scheduling-v2.test.ts tests/server/dual-sync-queue-worker.test.ts tests/server/dual-sync-queue-jobs.test.ts tests/server/dual-sync-google-update-overlay.test.ts tests/server/dual-sync-google-update-refresh.test.ts tests/server/dual-sync-notification-participation.test.ts tests/server/google-business-profile/wave2d-provider.test.ts tests/server/google-business-profile-service-connection-lifecycle-runtime.test.ts tests/server/dual-sync-terminal-notices.test.ts tests/server/dual-sync-notifications-cron-route.test.ts tests/server/google-business-profile-notifications-route.test.ts tests/server/dual-sync-exact-consent-repository.test.ts tests/config/vercel-crons.test.ts --reporter=dot` — PASS, 16 files/86 tests.
- `./node_modules/.bin/tsc --noEmit --pretty false` — PASS.
- `pnpm exec vitest ...` — infrastructure/toolchain failure before tests: pnpm signature verification attempted unavailable registry fetch. Re-run through the checked-in Vitest binary succeeded.
- Existing broad artifact `.omo/evidence/gbp-wave2d-broad.log` — 96 files/588 tests passed; inspected but treated as untrusted supplementary evidence.
- Existing exact schema artifact `.omo/evidence/gbp-wave2d-schema-contract.log` — 18 tests passed; inspected but does not cover the two runtime defects above.

## Checked artifact paths

- `.omo/evidence/gbp-wave2d-doneclaim.json`
- `.omo/evidence/gbp-wave2d-inventory.log`
- `.omo/evidence/gbp-wave2d-broad.log`
- `.omo/evidence/gbp-wave2d-schema-contract.log`
- `server/dual-sync/pubsub/*.ts`
- `server/dual-sync/notifications/{participation,terminal}.ts`
- `server/dual-sync/scheduling/refresh.ts`
- `server/dual-sync/freshness/*.ts`
- `server/google-business-profile/{notificationClient,serviceNotificationParticipationRuntime,serviceConnectionLifecycleRuntime}.ts`
- `src/app/api/webhooks/google-business-profile/pubsub/route.ts`
- `src/app/api/cron/dual-sync/{refresh,notifications}/route.ts`
- `src/app/api/ops/restaurants/[id]/google-business-profile/notifications/route.ts`
- `supabase/migrations/20260809120000_gbp_write_safety_foundation.sql`
- `vercel.json`
- all 16 focused test files listed in the reproduced command.

## Exact evidence gaps

- No test simulates successful `notification.emit` followed by failed delivered-finalization and proves no duplicate operational delivery.
- No database/integration test creates more than the reconciliation limit of already-materialized old grants plus a newer missing terminal notice and proves the missing notice is selected.
- No direct two-session exact-current Docker concurrency rerun was available; this is an external verification gap, not the basis for rejection.
- No separate code-review report containing an explicit programming/remove-AI-slops pass was found for Wave2D. This direct gate pass supplied that review; report absence is not itself a blocker.

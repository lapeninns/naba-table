# GBP final remediation — independent code-quality review 2

**Verdict: PASS**  
**codeQualityStatus: WATCH**  
**recommendation: APPROVE**

**Authoritative re-stamp:** 2026-08-10 against shared-worktree source fingerprint
`7fa1ff4b71354b28d669efdcc87a5c663e9663ec2bf29c7649858b078041fdd2`.

## Scope and evidence examined

- Goal: complete GBP remediation against base `a583de5d278b2cb5fd1bda248648a8c303f8c35e`; requested focus was the SQL resource allowlist and stranded dispatched-grant recovery.
- Current migration: `supabase/migrations/20260809120000_gbp_write_safety_foundation.sql` (SHA-256 `1417635bf2635ed5c94a5ad9a704b304c6c8df562558f182db07c6cb190d38dd`).
- Runtime recovery: `server/dual-sync/health/dispatched-grant-recovery.ts`, called by the cron health route.
- Relevant permit/exact-consent and recovery tests, generated Supabase types, and the current-hash PostgreSQL evidence in `.omo/evidence/gbp-wave1a-schema.log` and `.omo/evidence/gbp-wave1a-schema-pg-current.log`.
- Re-stamp delta: `docs/ops/gbp-route-map.md` only. It corrects the stale claim that the active client calls legacy `/google-business/locations`, documents the canonical `/google-business-profile/locations` caller, and records the seven source-configured cron routes plus the traffic-based retirement gate. No production TypeScript, SQL, configuration, or test source changed in this delta.
- Final fingerprint delta: generated `next-env.d.ts` normalization back to the committed `.next/types/routes.d.ts` reference only. No shipped source or test behavior changed; verdict remains PASS.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

1. `tests/server/dual-sync-dispatched-grant-recovery.test.ts:24` overstates its integration value. The test mutates its own `Map`, increments its own notice counter, and asserts an inert `providerTransport` array; none of those effects are performed by the recovery runtime or its Supabase adapter. It does cover cutoff/capping/error orchestration, but the headline “materializes a notice, and never re-emits” is tautological and does not lock either behavior. This violates the remove-ai-slops test-relevance perspective. Keep the independently verified PostgreSQL driver as substantive coverage, but replace/augment this with an adapter/route test that asserts the recovery RPC receives the exact fence and that terminal-notice reconciliation runs after it.

### LOW

1. The project `pnpm` wrapper could not verify the configured pnpm 10.34.5 registry signature in this environment, so `pnpm vitest` and `pnpm typecheck` cannot be used here. This is an environment/package-manager integrity condition, not a source failure. The repository-local binaries completed the focused gates below.

## Required-fix verification

### Canonical resource allowlist

Verified fixed. `issue_gbp_write_bundle_v1` at `supabase/migrations/20260809120000_gbp_write_safety_foundation.sql:2015` accepts exactly `locations/<external_location_id>` or the exact FoodMenus resource; it no longer permits the previous templated/interpolated `locations/{locationId}` form. The table constraint at lines 256–257 matches that policy. The current-hash PostgreSQL driver records passes for valid location/FoodMenus resources and near misses.

### Finalize-failure / stranded dispatched grants

Verified fixed. After a provider dispatch, `writePermit.ts:179-188` converts a terminal-persistence failure into `GoogleWriteOutcomeUnknownError`, leaving the durable state eligible for recovery rather than retrying the provider write. The health cron invokes `recoverStaleGbpDispatchedGrants` at `src/app/api/cron/dual-sync/health/route.ts:81-102`. The adapter fences each RPC call by tenant, external-profile identity, account/profile/location IDs, connection generation, and consent epoch (`dispatched-grant-recovery.ts:99-110`). The SQL recovery function at migration lines 2388–2474 takes `FOR UPDATE SKIP LOCKED`, changes stale `dispatched` grants to `outcome_unknown`, cancels later `claimed` grants, and creates the corresponding immutable events. The current-hash PostgreSQL driver and two-session evidence record recovery/no-re-emission and the final `outcome_unknown|cancelled_after_bundle_failure|1|1` invariant.

## Skill-perspective check

Ran: `omo:remove-ai-slops` and `omo:programming` (including the TypeScript rules/type/error-handling references) before judging maintainability and test relevance.

- Production code: no newly found `any`, unsafe type assertion, ignored type error, boundary parsing unrelated to the goal, needless normalization, or required-source complexity violation in the reviewed recovery/permit path. The recovery module is 154 pure LOC and has a real adapter seam.
- Tests: the MEDIUM finding above is a tautological/implementation-adjacent scenario test. No deletion-only test was found in the reviewed fix set.

## Executed verification

- `./node_modules/.bin/vitest run tests/server/gbp-wave1a-schema.test.ts tests/server/dual-sync-dispatched-grant-recovery.test.ts tests/server/google-business-profile/write-permit-bundle.test.ts tests/server/dual-sync-exact-consent-workflow.test.ts tests/server/dual-sync-exact-consent-repository.test.ts --reporter=dot` — PASS, 5 files / 58 tests.
- `./node_modules/.bin/tsc --noEmit` — PASS.
- `./node_modules/.bin/eslint server/dual-sync/health/dispatched-grant-recovery.ts server/google-business-profile/writePermit.ts tests/server/dual-sync-dispatched-grant-recovery.test.ts tests/server/gbp-wave1a-schema.test.ts` — PASS.
- `git diff --check a583de5d278b2cb5fd1bda248648a8c303f8c35e` — PASS.
- Re-stamp evidence supplied for the documentation/canonical-client delta: docs plus canonical-client tests — PASS, 5/5; formatting and diff checks — PASS. Direct inspection confirms the document now agrees with `src/services/ops/restaurants.ts` on the canonical locations endpoint.

## Blockers

None. The MEDIUM test-quality issue should be addressed in normal follow-up work, but it does not invalidate the independently executed schema recovery proof or block approval of the two requested repairs.

# GBP Wave 4 Gate Review

## recommendation

APPROVE

## originalIntent

Ship the Wave 4 compatibility and operations closure: move the live available-locations caller to the canonical Google Business Profile route without deleting the legacy compatibility route; schedule all seven dual-sync cron jobs exactly once; preserve singleton/auth/no-store behavior; use structured metadata-only GBP failure logging; document route wiring and production safety; and provide a fail-closed, metadata-only external release-readiness gate covering canary grants/restoration, Pub/Sub IAM/DLQ, key rotation, retention, backup/PITR, traffic-based retirement, and permit-aware flags-off rollback.

## desiredOutcome

The repository should expose the canonical caller and protected route, retain compatibility, have an exact seven-cron source schedule, keep sensitive provider/error material out of the reviewed logs, provide executable release-evidence validation plus usable runbooks, and pass the repository validation required by `AGENTS.md` before handoff.

## userOutcomeReview

The requested Wave 4 behavior is present and its focused executable evidence reproduces. The combined focused invocation passed 11 files and 62 tests. `tsc --noEmit` passed. The readiness template exits 1, reports all 18 required artifact identifiers missing/invalid, and does not echo template metadata values. Direct source inspection confirms the canonical route performs restaurant-id resolution and admin access before provider budgeting/service access, returns private/no-store responses, and returns a fixed provider-failure body. The browser service has one canonical locations caller and the legacy route still exists. `vercel.json` contains exactly the seven requested dual-sync cron entries; each route calls `requireCronAuthAndRun`, which provides authentication, rate limiting, and a per-job in-process execution lock. The production checklist/runbooks explicitly cover two canary grants and restoration, Pub/Sub topic/subscription/DLQ/IAM, key-rotation dry-run, retention and backup/PITR evidence, traffic-based legacy retirement, and permit-aware flags-off rollback.

The former Wave 4 blocker is repaired. `server/dual-sync/contracts/manifest.ts` now uses Luxon `DateTime.fromISO(..., { setZone: true }).toMillis()` for issued/expiry comparisons. Its focused ESLint, Prettier, diff check, typecheck, and remediation-contract tests pass. The expanded independent matrix passes 12 files and 86 tests.

Repository ESLint completes with zero errors and five unrelated warnings. The subsequent typography guard reports 52 raw heading utilities against a baseline of 49, but the identical failure reproduces from an isolated `git archive HEAD`; no current `.tsx` diff adds a raw `text-2xl` through `text-7xl` utility. Repository formatting still reports `lib/observability/request-correlation.ts`, and the same failure reproduces from `HEAD`. Both are committed baseline debt, not Wave 4 regressions, so neither blocks this goal.

## blockers

None.

## direct remove-ai-slops / programming pass

- Production behavior is not implemented through deletion-only logic, speculative wrappers, prompt parsing, or unnecessary normalization in the reviewed Wave 4 files.
- Canonical route tests exercise observable status/headers/body and access/provider-call boundaries. They are mock-heavy but not tautological: regressions in authorization ordering, route path, no-store headers, refresh action, or safe error output would fail.
- The cron configuration test is appropriate machine-consumed configuration coverage and checks exact set equality, duplicate prevention, and schedules.
- `tests/scripts/gbp-ops-docs-contract.test.ts` pins prose fragments in documentation. Under the `remove-ai-slops`/`programming` criteria this is overfit review-by-string and creates maintenance burden; direct document inspection, not this test, establishes the documentation outcome. This is a NOTE, not a blocker, because the actual requested documentation exists and no stated criterion requires that particular test shape.
- The readiness checker and its tests are structurally small, boundary-validate JSON, reject unknown fields/duplicates/malformed metadata, suppress supplied metadata in output, and fail closed. The required artifact ID list is duplicated between production/test/template, but the test compares observable CLI behavior and the template provides a human workflow; this is acceptable bounded duplication rather than an unnecessary abstraction trigger.
- No Wave 4 code-review artifact was found that explicitly records the required programming/remove-ai-slops overfit criteria. Direct gate inspection supplies the coverage, so this is an evidence gap rather than an additional blocker.

## checkedArtifactPaths

- `.omo/evidence/gbp-wave4-canonical-callers.doneclaim.json`
- `.omo/evidence/gbp-wave4-canonical-callers.validation-summary.json`
- `.omo/evidence/gbp-wave4-crons.json`
- `.omo/evidence/gbp-wave4-logging.summary.md`
- `.omo/evidence/gbp-wave4-ops-summary.json`
- `.omo/evidence/gbp-wave4-ops-template-fail-closed.json`
- `src/app/api/ops/restaurants/[id]/google-business-profile/locations/route.ts`
- `src/app/api/ops/restaurants/[id]/google-business/locations/route.ts`
- `src/services/ops/restaurants.ts`
- `server/security/cron-auth.ts`
- all seven `src/app/api/cron/dual-sync/*/route.ts` scheduled in `vercel.json`
- `scripts/verify/gbp-release-readiness.mjs`
- `scripts/verify/gbp-release-readiness.template.json`
- `docs/ops/gbp-route-map.md`
- `docs/ops/dual-sync-runbooks.md`
- `docs/ops/gbp-production-wiring-checklist.md`
- `docs/ops/gbp-operational-safety-review.md`
- focused test files named in the combined 62-test invocation

## reproducedEvidence

- `./node_modules/.bin/vitest run ...` across the Wave 4 focused test files plus `tests/server/dual-sync-remediation-contracts.test.ts`: PASS, 12 files / 86 tests.
- `./node_modules/.bin/tsc --noEmit`: PASS, exit 0.
- `node scripts/verify/gbp-release-readiness.mjs --input scripts/verify/gbp-release-readiness.template.json`: expected fail-closed exit 1; 18 required, 0 verified; identifiers/counts only.
- `./node_modules/.bin/eslint server/dual-sync/contracts/manifest.ts`: PASS, exit 0.
- `./node_modules/.bin/prettier --check server/dual-sync/contracts/manifest.ts`: PASS, exit 0.
- `git diff --check -- server/dual-sync/contracts/manifest.ts`: PASS, exit 0.
- Repository ESLint phase: PASS with 0 errors and 5 warnings. Shadcn and shadow-root guards pass.
- Typography guard: FAIL at 52 versus baseline 49, but an isolated `git archive HEAD` run fails identically, proving committed baseline debt.
- `./node_modules/.bin/prettier --check lib/observability/request-correlation.ts`: FAIL.
- `git show HEAD:lib/observability/request-correlation.ts | ./node_modules/.bin/prettier --check --stdin-filepath lib/observability/request-correlation.ts`: FAIL, proving the format drift exists in the committed baseline.

## exactEvidenceGaps

- No Wave 4 code-review report explicitly covering programming and remove-ai-slops/overfit criteria was found.
- No separate manual QA matrix was found for Wave 4; the focused route/CLI/config tests and direct source/doc inspection provide local coverage, while the documents correctly state that remote scheduler, Supabase, Google, Pub/Sub, canary, backup/PITR, retention, and traffic evidence remain external release gates.
- The current worktree has no ulw-loop plan, so the mandated fallback report path `.omo/evidence/gbp-wave4-gate-review.md` was used.

## notes

- The in-process cron lock is singleton only within one runtime instance. The stated Wave 4 source contract and existing docs call it an in-process lock; no criterion reviewed here requires a distributed singleton.
- The pre-existing formatting and typography-ratchet failures do not block this Wave 4 gate, but repository-wide validation remains non-green until that committed baseline debt is separately corrected.

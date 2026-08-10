# GBP final runtime debugging audit 2

**Audit status: PASS for deterministic runtime surfaces; INCONCLUSIVE for fresh browser execution.**

Base HEAD: `a583de5d278b2cb5fd1bda248648a8c303f8c35e`  
Requested worktree fingerprint: `7fa1ff4b71354b28d669efdcc87a5c663e9663ec2bf29c7649858b078041fdd2`  
Runtime: Node `v22.23.1`, Vitest `v4.1.0`.

Restamp verification: the only post-audit normalization is generated `next-env.d.ts` to the
committed production import during build; no product source changed. The deterministic
runtime verdict and environment-limited browser verdict below are unchanged.

## Runtime hypotheses and observations

| Hypothesis                                                                                           | Distinguishing runtime evidence                                                                                                              | Finding                                        |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| H1: finalize/recovery can replay or falsely complete a dispatched notification after a finalize gap. | Driver reports `finalizeFailureObserved: true`, `transportCalls: 1`, `finalStatus: "outcome_unknown"`, ending `dispatched->outcome_unknown`. | **Rejected as a product defect.**              |
| H2: tenant or OAuth state can cross-bind during recovery/callback.                                   | Outbox driver reports distinct tenant candidate keys and no provider calls; 8 OAuth/route files pass 36 tests.                               | **Rejected as a product defect.**              |
| H3: stale location/cache state still leaks into the shipped path.                                    | Access/connection-state/preflight/OAuth-state tests pass 26/26; canonical route tests pass. Browser was blocked before app startup.          | **No deterministic product failure observed.** |
| H4: a silent success/error path remains in the touched notification and GBP routes.                  | Focused tests pass; catches map to safe errors/outcomes. One adjacent `void console_.emit(...)` remains a low-risk follow-up.                | **No observed silent product failure.**        |

## Executed evidence

- Async/finalize recovery: one transport, durable `outcome_unknown`, no replay — [async driver](gbp-final-debug-runtime2-async-driver.log).
- Tenant/reclaim: distinct tenant keys across crash/reclaim; provider calls zero — [tenant driver](gbp-final-debug-runtime2-tenant-driver.log).
- Async, exact-consent, notification, OAuth pack: 8 files/49 tests passed — [focused](gbp-final-debug-runtime2-focused.log).
- Canonical details/locations/write-access/notifications/exact-food-menu/privacy/service/OAuth pack: 8 files/36 tests passed — [routes/oauth](gbp-final-debug-runtime2-routes-oauth.log).
- Stale cache/connection/preflight/OAuth-state pack: 4 files/26 tests passed — [stale state](gbp-final-debug-runtime2-stale-state.log).
- Current E2E inventory: exactly 5 tests — [E2E list](gbp-final-debug-runtime2-e2e-list.log).
- TypeScript `EXIT_CODE=0` — [typecheck](gbp-final-debug-runtime2-typecheck.log); E2E ESLint `EXIT_CODE=0` — [lint](gbp-final-debug-runtime2-lint.log); `git diff --check EXIT_CODE=0` — [diff check](gbp-final-debug-runtime2-diff-check.log).
- Silent-failure scan — [scan](gbp-final-debug-runtime2-silent-scan.log).

## Browser blocker classification

Exact invocation:

```text
QA_APP_PORT=5180 GBP_CAPTURE_EVIDENCE=0 ./node_modules/.bin/playwright test tests/e2e/ops-gbp-dual-sync.spec.ts --config=playwright.app.config.ts --reporter=line
```

Run 1 failed before app startup because the config invokes bare `tsx` and the direct shell had no local-bin PATH (`/bin/sh: tsx: command not found`) — [run1](gbp-final-debug-runtime2-e2e-run1.log).

With `PATH="$PWD/node_modules/.bin:$PATH"`, `tsx` reached IPC setup but failed `listen EPERM` under the macOS temp directory; with `TMPDIR=/tmp` it failed the same way for `/tmp/tsx-*/…pipe` — [run2](gbp-final-debug-runtime2-e2e-run2.log), [run3](gbp-final-debug-runtime2-e2e-run3.log). No Chromium launch or app request occurred, and no escalation was attempted. This is a harness/environment blocker, not a shipped GBP defect.

Previously captured browser artifacts were inspected and remain supplementary evidence for exact publish/outcome, connect, disconnect, unconfigured lock, and canonical location journeys (`gbp-final-review-*.log` and `gbp-final-review-canonical-journey.md`). They do not substitute for the blocked fresh consecutive run.

## manualQa

### surfaceEvidence

| Scenario id   | Criterion reference                                     | Surface                | Exact invocation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Verdict                                          | ArtifactRefs                       |
| ------------- | ------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------- |
| R2-ASYNC-01   | Durable dispatch/finalize-gap recovery                  | Node CLI driver        | `node --import tsx .omo/evidence/gbp-wave2d-truthful-delivery-driver.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | PASS                                             | `async-driver`                     |
| R2-TENANT-01  | Tenant isolation and crash reclaim                      | Node CLI driver        | `node --import tsx .omo/evidence/gbp-wave2b-outbox.driver.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | PASS                                             | `tenant-driver`                    |
| R2-OAUTH-01   | OAuth nonce/state/tenant binding and callback rejection | Vitest CLI             | `./node_modules/.bin/vitest run tests/server/google-business-profile-details-route.test.ts tests/server/google-business-profile-locations-route.test.ts tests/server/google-business-profile-write-access-route.test.ts tests/server/google-business-profile-notifications-route.test.ts tests/server/google-business-profile-food-menus-exact-route.test.ts tests/server/google-business-profile-route-privacy.test.ts tests/server/google-business-profile-service-public.test.ts tests/server/google-business-profile/client-auth.test.ts tests/server/google-business-profile/client-identity.test.ts --reporter=dot` | PASS (8 files/36 tests)                          | `routes-oauth`                     |
| R2-STALE-01   | Stale location/cache and refresh handling               | Vitest CLI             | `./node_modules/.bin/vitest run tests/server/google-business-profile-service-access-runtime.test.ts tests/server/google-business-profile-service-connection-state-runtime.test.ts tests/server/google-business-profile-workflow-preflight-context.test.ts tests/server/google-business-profile-service-oauth-state.test.ts --reporter=dot`                                                                                                                                                                                                                                                                                | PASS (4 files/26 tests)                          | `stale-state`                      |
| R2-ASYNC-02   | Async notification/exact-consent behavior               | Vitest CLI             | `./node_modules/.bin/vitest run tests/server/dual-sync-dispatched-grant-recovery.test.ts tests/server/dual-sync-exact-consent-workflow.test.ts tests/server/dual-sync-exact-consent-claimed-execution.test.ts tests/server/dual-sync-notifications.test.ts tests/server/google-business-profile-service-authorization-flow.test.ts tests/server/google-business-profile-service-authorization-runtime.test.ts tests/server/google-business-profile-oauth-state-cookie.test.ts tests/server/google-business-profile-callback-route.test.ts --reporter=dot`                                                                 | PASS (8 files/49 tests)                          | `focused`                          |
| R2-BROWSER-01 | Five-scenario shipped GBP browser journey               | Playwright browser UI  | `QA_APP_PORT=5180 GBP_CAPTURE_EVIDENCE=0 ./node_modules/.bin/playwright test tests/e2e/ops-gbp-dual-sync.spec.ts --config=playwright.app.config.ts --reporter=line`                                                                                                                                                                                                                                                                                                                                                                                                                                                       | INCONCLUSIVE — harness could not start `tsx`/IPC | `e2e-run1`, `e2e-run2`, `e2e-run3` |
| R2-STATIC-01  | Current E2E inventory/stale harness surface             | Playwright CLI listing | `PATH="$PWD/node_modules/.bin:$PATH" ./node_modules/.bin/playwright test tests/e2e/ops-gbp-dual-sync.spec.ts --config=playwright.app.config.ts --list`                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | PASS (5 tests listed)                            | `e2e-list`                         |
| R2-QUALITY-01 | Type safety, lint, whitespace                           | Node CLI               | `./node_modules/.bin/tsc --noEmit --pretty false`; `./node_modules/.bin/eslint tests/e2e/ops-gbp-dual-sync.spec.ts`; `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | PASS                                             | `typecheck`, `lint`, `diff-check`  |

### adversarialCases

| Scenario id | Criterion reference  | Adversarial class                                        | Expected behavior                                                            | Verdict                           | ArtifactRefs                             |
| ----------- | -------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------- |
| ADV-R2-01   | Dispatch uncertainty | Transport succeeds but finalize fails                    | Persist `outcome_unknown`; exactly one transport call; never claim delivered | PASS                              | `async-driver`                           |
| ADV-R2-02   | Tenant isolation     | Crash/reclaim with two tenant candidates                 | Preserve distinct tenant keys; no provider cross-call                        | PASS                              | `tenant-driver`                          |
| ADV-R2-03   | OAuth security       | Malformed/mismatched nonce/state or wrong restaurant     | Reject or return no tenant; never complete another restaurant                | PASS                              | `routes-oauth`, `focused`                |
| ADV-R2-04   | Stale state          | Cached locations and force-refresh/preflight stale state | Cache bounded; refresh current; stale draft explicitly marked                | PASS                              | `stale-state`                            |
| ADV-R2-05   | Browser harness      | Missing local-bin PATH and restricted IPC socket         | Surface startup blocker; do not misclassify as product behavior              | PASS (environment classification) | `e2e-run1`, `e2e-run2`, `e2e-run3`       |
| ADV-R2-06   | Silent failure       | Caught provider/transport errors                         | Safe HTTP error or typed ambiguous/definitive outcome, never false success   | PASS for exercised paths          | `focused`, `routes-oauth`, `silent-scan` |

### artifactRefs

| id              | kind                   | description                                 | path                                                       |
| --------------- | ---------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| `async-driver`  | CLI transcript         | Durable dispatch/finalize-gap output        | `.omo/evidence/gbp-final-debug-runtime2-async-driver.log`  |
| `tenant-driver` | CLI transcript         | Tenant outbox crash/reclaim output          | `.omo/evidence/gbp-final-debug-runtime2-tenant-driver.log` |
| `focused`       | Vitest transcript      | Async/OAuth/notification tests              | `.omo/evidence/gbp-final-debug-runtime2-focused.log`       |
| `routes-oauth`  | Vitest transcript      | Canonical route/privacy/service/OAuth tests | `.omo/evidence/gbp-final-debug-runtime2-routes-oauth.log`  |
| `stale-state`   | Vitest transcript      | Cache/refresh/preflight/OAuth-state tests   | `.omo/evidence/gbp-final-debug-runtime2-stale-state.log`   |
| `e2e-list`      | Playwright transcript  | Current five-test inventory                 | `.omo/evidence/gbp-final-debug-runtime2-e2e-list.log`      |
| `e2e-run1`      | Playwright transcript  | Bare `tsx` PATH blocker                     | `.omo/evidence/gbp-final-debug-runtime2-e2e-run1.log`      |
| `e2e-run2`      | Playwright transcript  | Local PATH IPC `EPERM` blocker              | `.omo/evidence/gbp-final-debug-runtime2-e2e-run2.log`      |
| `e2e-run3`      | Playwright transcript  | `/tmp` IPC `EPERM` blocker                  | `.omo/evidence/gbp-final-debug-runtime2-e2e-run3.log`      |
| `typecheck`     | CLI transcript         | TypeScript `EXIT_CODE=0`                    | `.omo/evidence/gbp-final-debug-runtime2-typecheck.log`     |
| `lint`          | CLI transcript         | E2E ESLint `EXIT_CODE=0`                    | `.omo/evidence/gbp-final-debug-runtime2-lint.log`          |
| `diff-check`    | CLI transcript         | `git diff --check` `EXIT_CODE=0`            | `.omo/evidence/gbp-final-debug-runtime2-diff-check.log`    |
| `silent-scan`   | Static scan transcript | Catch/void patterns reviewed                | `.omo/evidence/gbp-final-debug-runtime2-silent-scan.log`   |

## Follow-up not taken

`server/dual-sync/notifications/index.ts:115` uses `void console_.emit(...)` from the webhook `onError` callback. The console port catches logger failures, so no failure was observed; a custom console port could reject asynchronously and become unhandled. Low-risk observability follow-up; not changed.

## Cleanup

No QA listener remains on ports 5180/5174, no Node inspector or tsx socket remains, and the temporary debugging journal was removed. Product source was not edited.

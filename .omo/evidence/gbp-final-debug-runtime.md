# GBP Wave 3 final runtime debugging

Status: **BLOCKED AFTER PARTIAL GREEN** — the confirmed defects are fixed, but the final capture-isolation toggle could not be executed twice because the Chromium sandbox escalation service rejected further runs after reporting an account usage limit. Production authentication and proxy behavior were not changed.

## Reproduction and hypotheses

Exact browser invocation (local authenticated QA host, one worker):

```text
./node_modules/.bin/playwright test tests/e2e/ops-gbp-dual-sync.spec.ts --config .omo/evidence/gbp-wave3-production-playwright.config.ts --reporter=line
```

| Hypothesis                                                | Toggle / binary observable                                                                                                                 | Result                                                                                                                                                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Query state leaks between scenarios                 | Each Playwright test creates a fresh context; failed traces were checked for API traffic and rendered query errors.                        | Rejected. The location failure returned `undefined` from the current request; the unconfigured failure made no client API request at all.                                                                              |
| API mocks incompletely match or assertions race hydration | Compare requested URLs in trace with exact route matchers; then await the rich-connection response rather than server-shell `networkidle`. | Confirmed twice. See root cause below.                                                                                                                                                                                 |
| RSC/server state is stale                                 | Inspect failed snapshots/network for a prior fixture response.                                                                             | Rejected. Unconfigured snapshot was the static server shell with `Loading sync state`; it contained no fixture API response.                                                                                           |
| Proxy host rewrite causes the suite failure               | Run the configured server without forced `-H 127.0.0.1` and inspect navigation.                                                            | Rejected for the shipped Playwright invocation. It returned 200 with relative `x-middleware-rewrite: /app/...`; the reported 308 loop was specific to the earlier forced-host probe. No proxy/auth source was changed. |

## Root cause and smallest fix

1. The application requests `GET /api/ops/restaurants/:id/google-business-profile/locations`, but the E2E catch-all mocked `/google-business/locations`. The unmatched request received the harness fallback `{}`, so `response.locations` was `undefined`. The retained trace and browser log show the exact TanStack key and `data is undefined`. The one-line matcher correction made the location-picker scenario pass in the next full run.
2. `waitForLoadState('networkidle')` could complete on the server-rendered shell before the client GBP chunk hydrated. The unconfigured failure trace contains zero `/api/ops` requests and still shows `Loading sync state`. Navigation now awaits the exact rich-connection GET before fixture-specific assertions.
3. The functional scenario was also rewriting eleven large PNG evidence files in every normal run. This load remained coupled to the shared browser worker; after a long screenshot scenario, the next context could fail to hydrate for the entire 60-second test, while the Playwright worker restart made scenarios 3–5 pass. Evidence generation is now explicit with `GBP_CAPTURE_EVIDENCE=1`; default regression runs retain the responsive, dialog-scroll, focus-trap, Escape/restoration, exact-publish, and outcome assertions without PNG writes or dev-portal mutation.

No production UI, auth, service, route, or proxy code was changed in this debugging repair.

## Red → green evidence

| Scenario                                | Invocation / observable                                                                                         | Result                                                                                                                                                                     | Artifact                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Baseline full five-scenario suite       | Exact invocation above; location-picker rendered `data is undefined`.                                           | RED: 4 passed / 1 failed in this direct reproduction (supplied audit also recorded repeatable 3/5).                                                                        | `.omo/evidence/gbp-wave3-debug-baseline.log`                      |
| Path + hydration synchronization toggle | Exact full five-scenario invocation; all five scenario names completed.                                         | GREEN: 5 passed in 17.1s.                                                                                                                                                  | `.omo/evidence/gbp-wave3-debug-green-run1.log`                    |
| Consecutive pre-isolation run           | Same invocation; scenario 2 awaited an API response for 60s, then worker restart allowed scenarios 3–5 to pass. | RED: 4 passed / 1 failed; established remaining shared-browser/capture coupling.                                                                                           | `.omo/evidence/gbp-wave3-debug-pre-capture-isolation-failure.log` |
| Final capture-isolation confirmation    | Same invocation after explicit screenshot gating.                                                               | BLOCKED: macOS sandbox Chromium fails MachPort registration; required escalation was rejected with approval-service usage limit until 2026-08-15. No workaround attempted. | Tool transcript; no false green artifact recorded.                |

## Static and focused gates

| Gate                  | Binary observable                            | Result                                                                                                                                                                                                             | Artifact                                          |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Focused UI/hook tests | 10 files / 34 tests                          | PASS                                                                                                                                                                                                               | `.omo/evidence/gbp-wave3-debug-focused-tests.log` |
| TypeScript            | `TYPECHECK_OK` from local `tsc --noEmit`     | PASS                                                                                                                                                                                                               | `.omo/evidence/gbp-wave3-debug-typecheck.log`     |
| Focused lint          | `ESLINT_OK` for the changed E2E file         | PASS                                                                                                                                                                                                               | `.omo/evidence/gbp-wave3-debug-lint.log`          |
| Format                | Prettier reports all matched files formatted | PASS                                                                                                                                                                                                               | `.omo/evidence/gbp-wave3-debug-format.log`        |
| Production build      | `next build --webpack`                       | BLOCKED by sandbox DNS: `ENOTFOUND fonts.googleapis.com` for Geist Mono, Inter, and Merriweather. The normal package-manager command was separately blocked when Corepack could not verify/download pnpm metadata. | `.omo/evidence/gbp-wave3-debug-build.log`         |

## Cleanup

- Local QA server on port 5180 was terminated; no listener remained.
- Temporary QA launcher and debugging journal were removed after this report.
- Production auth bypass was not added or weakened.
- Final acceptance still requires two consecutive five-scenario runs in an environment permitted to launch Chromium, plus a network-capable production build (or the already-configured font cache).

# QA E2E Smoke

The three unauthenticated Playwright browser smoke packs run through:

```sh
pnpm run qa:public-booking:browser
pnpm run qa:ops-lifecycle:browser
pnpm run qa:guest-portal:browser
```

Each pack is a direct `playwright test <spec>` (no `run-guarded-command` wrapper, so no
destructive-mode opt-ins). The default `playwright.config.ts` webServer boots the reserve
Vite app (port 5174) and `next dev` (port 5180) with mock env (`QA_USE_MOCKS=1`, dummy
Supabase credentials, localhost-only targets) and runs
`scripts/qa/clear-next-dev-lock.ts` first so a stale `.next/dev/lock` cannot block boot.

## What runs where

CI enforcement lives in `.github/workflows/e2e-smoke.yml` (spec:
`MS-foundation-playwright-ci-gate`). A single job runs the three packs sequentially (they
share the dev-server ports) on every pull request, every push to `main`, and on manual
dispatch — with `timeout-minutes: 30`, no `continue-on-error`, and Playwright
traces/screenshots/videos from `test-results/qa/` uploaded as artifacts on failure only.

The workflow installs Chromium explicitly (`pnpm exec playwright install chromium
--with-deps`) before running any pack; browsers are deliberately not cached so a stale
cache can never mismatch the pinned `@playwright/test` version.
`.github/workflows/qa-pr-baseline.yml` gets the same install step unconditionally,
because its changed-path selector can pick Playwright smoke on UI-touching PRs and would
otherwise fail for lack of a browser binary (misclassified as a `product` failure).

The workflow env mirrors `test-suite.yml` sanitized values (`APP_ENV=test`,
`QA_TARGET_ENV=ci-ephemeral`, dummy Supabase/Resend credentials, `TZ=UTC`) plus
`QA_USE_MOCKS=1`; the Playwright webServer commands override app-facing values with
localhost equivalents, so no run can reach remote infrastructure.

`tests/qa/e2e-smoke-command.test.ts` is the wiring self-test: it fails if a trigger or
pack is dropped, the Chromium install step is removed from either workflow, the env
sanitization keys are removed, the artifact upload loses its `if: failure()` guard, or an
escape hatch is added.

## Local proof (2026-07-11, macOS, Playwright 1.58.1)

All three packs were run locally from a cold dev server before the workflow shipped:

| Pack                            | Result   | Tests    | Duration        |
| ------------------------------- | -------- | -------- | --------------- |
| `qa:public-booking:browser`     | pass     | 2 passed | 18.9s (Playwright), 19.5s wall |
| `qa:ops-lifecycle:browser`      | pass     | 4 passed | 10.7s (Playwright), 11.2s wall |
| `qa:guest-portal:browser`       | pass     | 6 passed | 24.9s (Playwright), 25.4s wall |

No pre-existing failures were found, so no pack is scoped out of the gate. (The
`DUPLICATE_RESOURCE` console error visible in the public-booking run is expected — it is
the fixture behind the friendly duplicate-booking-error test.)

## Why the authenticated packs are excluded

The authenticated app-host packs (`qa:ops-authenticated:browser`,
`qa:capacity-tables:browser`, `qa:settings-team:browser`, `qa:customers-delivery:browser`,
…) are not in this gate. QA fixture auth is currently broken at the edge-proxy layer: the
middleware bundle reads `env.QA_ENABLE_AUTH_FIXTURES` dynamically and the value is not
inlined at build time, so fixture-authenticated sessions never activate and every
authenticated spec redirects to sign-in. Gating those packs lands as a follow-up spec
once fixture auth is repaired. Nightly scheduling of the wider e2e matrix is likewise its
own spec.

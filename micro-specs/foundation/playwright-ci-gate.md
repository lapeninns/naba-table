---
spec_id: MS-foundation-playwright-ci-gate
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/foundation/**
  - micro-specs/evidence/**
  - .github/workflows/e2e-smoke.yml
  - .github/workflows/qa-pr-baseline.yml
  - tests/qa/**
  - docs/qa/**
implementation_surfaces:
  - micro-specs/foundation/playwright-ci-gate.md
  - .github/workflows/e2e-smoke.yml
  - .github/workflows/qa-pr-baseline.yml
  - tests/qa/e2e-smoke-command.test.ts
  - docs/qa/e2e-smoke.md
related_docs:
  - docs/qa/README.md
  - docs/qa/pr-baseline.md
related_tests:
  - tests/qa/e2e-smoke-command.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm run qa:foundation
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - Local run of the unauthenticated browser smoke packs proving they boot and pass.
approved_exceptions: []
---

# MS-foundation-playwright-ci-gate — Browser smoke packs gate CI

## 1. Exact Goal and User-Visible Outcomes

Playwright browser QA runs in CI at all. Today zero workflows install Playwright
browsers, so all 26 e2e specs are local-only — and worse, `qa-pr-baseline.yml` can
*select* Playwright smoke on UI-touching PRs and then fail confusingly for lack of a
browser binary (misclassified as a `product` failure). When this ships: a new
`e2e-smoke.yml` workflow runs the three unauthenticated browser smoke packs
(`qa:public-booking:browser`, `qa:ops-lifecycle:browser`, `qa:guest-portal:browser`)
on every PR and push to `main`, and `qa-pr-baseline.yml` gains a browser-install step
so its conditional Playwright selection can actually execute.

## 2. Blast Radius

In scope: `.github/workflows/e2e-smoke.yml` (new); a browser-install step added to
`.github/workflows/qa-pr-baseline.yml` (no other change to it); the wiring self-test
`tests/qa/e2e-smoke-command.test.ts`; `docs/qa/e2e-smoke.md`; this spec and its
evidence ledger.

Out of scope: the three Playwright config files (their local `next dev` webServer
design is correct as-is); the authenticated app-host packs (`qa:ops-authenticated`,
`qa:capacity-tables:browser`, `qa:settings-team:browser`, …) — QA fixture auth is
currently broken at the edge-proxy layer (`QA_ENABLE_AUTH_FIXTURES` not inlined into
the middleware bundle), so gating them in CI lands as a follow-up spec once fixture
auth is repaired; nightly scheduling (own spec); product source.

## 3. Strict Constraints and Assumptions

- CI runs browsers against the packs' existing mock/local design (`QA_USE_MOCKS=1`,
  local `next dev`, dummy Supabase env) — no real secrets, no remote targets.
- Browser install is `pnpm exec playwright install chromium --with-deps` (Chromium
  only — the configs' projects use Chromium; installing all browsers wastes CI time).
- The workflow must cache what it reasonably can (pnpm store via setup-node) but must
  not cache Playwright browsers incorrectly versus the pinned `@playwright/test`
  version; correctness beats speed.
- The three smoke packs must be proven locally before the workflow ships (run them;
  record pass/fail — if one is locally red for pre-existing reasons, surface it and
  scope it out explicitly rather than shipping a red gate).
- Assumption: guarded `:browser` packs run Playwright directly (no
  `run-guarded-command` wrapper on the browser half), so no destructive-mode env
  opt-ins are needed in CI.

## 4. Decisions Already Made

- One new workflow `e2e-smoke.yml`, triggers `pull_request` + `push:main` +
  `workflow_dispatch`, single job running the three packs sequentially (they share
  the dev-server port; parallel jobs would each boot their own server — acceptable
  later, sequential first).
- `timeout-minutes` set (e.g. 30) so a hung dev server cannot burn 6h of CI.
- Env block mirrors `test-suite.yml` sanitized values plus `QA_USE_MOCKS: '1'`.
- Upload Playwright traces/reports as artifacts on failure only
  (`actions/upload-artifact`, `if: failure()`).
- `qa-pr-baseline.yml` gets the same install step unconditionally (installing
  Chromium takes ~30s; conditional install adds fragile complexity).
- Self-test mirrors `full-suite-command.test.ts`: parse both workflow files, assert
  triggers, the three pack commands, the install step, sanitized env, artifact
  upload, and absence of `continue-on-error`.

## 5. Behavioral Requirements (EARS)

- WHEN a pull request is opened or updated, THE CI SHALL run the three
  unauthenticated browser smoke packs against a locally-booted app with mocks.
- WHEN commits are pushed to `main`, THE CI SHALL run the same browser smoke packs.
- WHILE any workflow may select or run Playwright, THE workflow SHALL install the
  pinned Chromium browser first.
- IF a browser pack fails in CI, THEN THE workflow SHALL fail and upload the
  Playwright report/trace artifacts for that run.
- THE tests/qa harness SHALL include a self-test that fails when the smoke workflow
  wiring (triggers, packs, install step, sanitized env) is removed or weakened.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- Local: each of the three packs passes (or any pre-existing failure is documented
  and explicitly scoped out before shipping).
- `tests/qa/e2e-smoke-command.test.ts` passes on the shipped wiring and fails when a
  trigger/pack/install step is removed.
- All declared verification gates pass.

Tasks (test-first):

1. Red: write `tests/qa/e2e-smoke-command.test.ts`.
2. Green: add `e2e-smoke.yml`; add the install step to `qa-pr-baseline.yml`.
3. Prove the three packs locally; document results in `docs/qa/e2e-smoke.md`.
4. Record gates and advance lifecycle.

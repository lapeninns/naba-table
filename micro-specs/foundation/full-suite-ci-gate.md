---
spec_id: MS-foundation-full-suite-ci-gate
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/foundation/**
  - micro-specs/evidence/**
  - Goal.md
  - package.json
  - .github/workflows/test-suite.yml
  - docs/qa/**
  - tests/qa/**
  - AGENTS.md
  - docs/sdlc/verification.md
implementation_surfaces:
  - micro-specs/foundation/full-suite-ci-gate.md
  - .github/workflows/test-suite.yml
  - package.json
  - Goal.md
  - docs/qa/full-suite.md
  - tests/qa/full-suite-command.test.ts
related_docs:
  - docs/qa/README.md
  - docs/sdlc/verification.md
related_tests:
  - tests/qa/full-suite-command.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm test:micro-specs
  - pnpm lint
  - pnpm typecheck
  - pnpm run qa:foundation
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-foundation-full-suite-ci-gate — Full-suite CI test gate

## 1. Exact Goal and User-Visible Outcomes

Every change to the repository — pull request or direct push to `main` — is forced through
the complete Vitest suite before it can be considered good. Today the full suite (~3,374
tests, ~40s) runs nowhere: CI runs only path-filtered slices on `pull_request`, so a direct
push can land a regression that existing tests already catch (this happened on 2026-07-11:
commit 4763635d broke 11 tests in 6 files and no check fired). When this spec ships, a
maintainer sees a red check on any PR or `main` push whose tree fails any Vitest test, and
`pnpm test` locally runs exactly what CI runs. `Goal.md` states the 100% QA program this
gate belongs to.

## 2. Blast Radius

In scope: a `test` script in `package.json`; one new workflow
`.github/workflows/test-suite.yml`; a QA-harness self-test under `tests/qa/`; pack
documentation under `docs/qa/`; the `Goal.md` program statement; correcting the
now-stale "there is no `pnpm test` script" statements in `AGENTS.md` and
`docs/sdlc/verification.md`; this spec and its evidence ledger.

Out of scope: Playwright/browser CI (own spec — needs browser install and dev-server
boot), coverage tooling (own spec), scheduled/nightly runs (own spec), fixing the 11
currently-failing tests (own spec: the Phase-0 baseline restoration), all other existing
workflows, all product source code, `vitest.config.ts`.

## 3. Strict Constraints and Assumptions

- The workflow must run with sanitized offline env only (dummy Supabase URL/keys,
  `APP_ENV=test`, `QA_TARGET_ENV=ci-ephemeral`) exactly like `qa-foundation.yml`; it must
  never receive real secrets. `tests/setup.ts` env fallbacks (`??=`) make this safe.
- `TZ=UTC` is pinned in the workflow so time-zone-sensitive tests are deterministic in CI.
- No `continue-on-error`, no test quarantine list, no path filters: the suite is fast
  enough to always run whole.
- The gate is expected to be RED until the Phase-0 baseline-restoration spec fixes the 11
  known failures on `main`; landing red is acceptable and intended (stop-the-line), but the
  two changes should merge as close together as possible.
- Assumption: a bare `vitest run` (config include `tests/**`, exclude `tests/e2e/**`)
  is the correct "complete suite" definition; e2e stays Playwright-owned.

## 4. Decisions Already Made

- Script name is `test` (`"test": "vitest run"`), so `pnpm test` works unqualified.
- New standalone workflow file `test-suite.yml`; do not extend `ai-governance.yml` (it
  owns governance gates, not product tests) or `qa-pr-baseline.yml` (changed-path
  selection stays as a faster advisory layer).
- Triggers: `pull_request` (all branches) and `push` to `main`, plus `workflow_dispatch`.
- Runner shape copies the sibling workflows: ubuntu-latest, corepack, Node 20, pnpm
  cache, `pnpm install --frozen-lockfile`.
- The self-test follows the existing `tests/qa/*-command.test.ts` pattern: parse
  `package.json` and the workflow YAML, assert the script exists, the triggers cover
  `pull_request` + `push:main`, the sanitized env keys are present, and no
  `continue-on-error` appears.

## 5. Behavioral Requirements (EARS)

- THE repository SHALL define a package.json `test` script that runs the complete
  non-e2e Vitest suite via the repo `vitest.config.ts`.
- WHEN a pull request is opened or updated, THE CI SHALL run the complete Vitest suite
  and report a failed check if any test fails.
- WHEN commits are pushed to `main`, THE CI SHALL run the complete Vitest suite and fail
  the workflow run if any test fails.
- WHILE the full-suite workflow executes, THE workflow SHALL export only sanitized
  offline environment values (dummy Supabase credentials, `APP_ENV=test`,
  `QA_TARGET_ENV=ci-ephemeral`, `TZ=UTC`).
- IF any Vitest test fails during the workflow, THEN THE workflow SHALL exit non-zero
  with no quarantine or continue-on-error escape hatch.
- THE tests/qa harness SHALL include a self-test that fails when the `test` script or the
  workflow wiring (triggers, suite command, sanitized env) is removed or weakened.
- THE Goal.md SHALL state the 100% QA program: six pillars, the 2026-07-11 audit
  snapshot, and the phased roadmap this spec is phase 1 of.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- `pnpm test` locally executes the full non-e2e suite (≥3,300 tests collected) and its
  exit code reflects test outcomes honestly.
- `tests/qa/full-suite-command.test.ts` fails if the `test` script is renamed, a trigger
  is dropped, the env sanitization keys are removed, or `continue-on-error` is added —
  and passes on the shipped configuration.
- `pnpm run qa:foundation` (tag guard + `tests/qa`) stays green with the new self-test.
- All declared verification gates pass.

Tasks (test-first):

1. Red: write `tests/qa/full-suite-command.test.ts` asserting the `test` script and
   `test-suite.yml` wiring; watch it fail.
2. Green: add the `test` script and `.github/workflows/test-suite.yml`.
3. Docs: `docs/qa/full-suite.md` (+ index line in `docs/qa/README.md`); fix the stale
   "no `pnpm test` script" lines in `AGENTS.md` and `docs/sdlc/verification.md`; keep the
   already-rewritten `Goal.md`.
4. Run `governance:run-gates --spec MS-foundation-full-suite-ci-gate --record`; advance
   with `governance:advance`.

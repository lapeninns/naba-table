---
spec_id: MS-foundation-nightly-rc
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/foundation/**
  - micro-specs/evidence/**
  - .github/workflows/nightly-qa.yml
  - tests/qa/**
  - docs/qa/**
implementation_surfaces:
  - micro-specs/foundation/nightly-rc.md
  - .github/workflows/nightly-qa.yml
  - tests/qa/nightly-qa-command.test.ts
  - docs/qa/nightly.md
related_docs:
  - docs/qa/README.md
  - docs/qa/release-candidate.md
related_tests:
  - tests/qa/nightly-qa-command.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm run qa:foundation
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-foundation-nightly-rc — Nightly release-candidate QA run

## 1. Exact Goal and User-Visible Outcomes

Drift gets caught within a day even when nobody opens a PR. Today there are zero
scheduled workflows — the release-candidate pack (`qa:rc`, 13 commands / 8 phases)
only runs when a human remembers to run it locally, and there is no persisted RC
ledger anywhere in the tree. When this ships, a nightly GitHub Actions run executes
the RC pack in its safe local/mock mode, uploads the redacted `rc-summary.json` and
browser artifacts, and a red night shows up as a failed scheduled run on `main`.

## 2. Blast Radius

In scope: `.github/workflows/nightly-qa.yml` (new); wiring self-test
`tests/qa/nightly-qa-command.test.ts`; `docs/qa/nightly.md`; this spec + evidence
ledger.

Out of scope: `scripts/qa/rc-pack.ts` behavior (its safe-default env handling is
already correct — it sets `QA_TARGET_ENV=local`, `QA_USE_MOCKS=1`, `QA_DRY_RUN=1`,
mock external-mutation mode, and refuses prod-like targets); PR gating (the
full-suite and e2e-smoke workflows own that); notification routing beyond the
built-in failed-run signal; product source.

## 3. Strict Constraints and Assumptions

- The nightly run uses the RC pack's own safe defaults — the workflow must NOT
  override them toward any remote target, and must never receive real secrets.
- Playwright browsers must be installed in the job (the RC pack includes browser
  phases), and the reserve app is built by the pack itself.
- `timeout-minutes` bounds the whole run (e.g. 90); artifacts upload on success AND
  failure (`if: always()`) since the RC ledger is the point.
- Schedule avoids peak: 03:17 UTC daily (odd minute per GitHub's guidance to avoid
  the top-of-hour thundering herd), plus `workflow_dispatch` for on-demand runs.
- Assumption: authenticated app-host browser phases inside `qa:rc` share the known
  QA-fixture-auth limitation; if any RC phase proves locally/CI red for that
  pre-existing reason, the workflow still ships and the failure is documented in
  `docs/qa/nightly.md` as the known-red set to burn down (a nightly that reports
  truthfully is the goal; do not mask with continue-on-error on the whole run —
  prefer scoping the pack invocation if a phase is structurally impossible in CI).

## 4. Decisions Already Made

- One workflow `nightly-qa.yml`: triggers `schedule` (03:17 UTC) +
  `workflow_dispatch`; single job; ubuntu-latest; corepack/Node 20/pnpm cache;
  `pnpm exec playwright install chromium --with-deps`; run `pnpm run qa:rc`; upload
  `test-results/qa/**` artifacts with `if: always()` and a 14-day retention.
- Env block: sanitized dummy values only (mirrors `test-suite.yml`), letting
  `rc-pack.ts` apply its own safe QA defaults on top.
- Self-test mirrors the other `*-command.test.ts` files: assert schedule + dispatch
  triggers, the `qa:rc` invocation, browser install, artifact upload `if: always()`,
  sanitized env, and no `continue-on-error`.

## 5. Behavioral Requirements (EARS)

- WHEN the scheduled time elapses each day, THE CI SHALL run the release-candidate
  pack in local/mock mode on `main`.
- WHILE the nightly job runs, THE workflow SHALL export only sanitized offline
  environment values and let the RC pack apply its own safe QA defaults.
- IF any RC phase fails, THEN THE workflow run SHALL be marked failed and the RC
  artifacts SHALL still be uploaded.
- THE tests/qa harness SHALL include a self-test that fails when the nightly wiring
  (schedule, RC invocation, browser install, artifact upload) is removed or
  weakened.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- `tests/qa/nightly-qa-command.test.ts` passes on the shipped wiring and fails when
  the schedule trigger, `qa:rc` invocation, or artifact upload is removed.
- Workflow YAML is valid (actionlint-style sanity via the self-test's structural
  assertions) and its env contains no secret-like values.
- All declared verification gates pass.

Tasks (test-first):

1. Red: `tests/qa/nightly-qa-command.test.ts`.
2. Green: add `nightly-qa.yml`.
3. Docs: `docs/qa/nightly.md` (incl. the known-red set, if any, and how to read the
   RC artifacts).
4. Record gates and advance lifecycle.

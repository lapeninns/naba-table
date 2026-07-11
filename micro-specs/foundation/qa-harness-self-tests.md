---
spec_id: MS-foundation-qa-harness-self-tests
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/foundation/**
  - micro-specs/evidence/**
  - tests/qa/**
  - tests/scripts/**
implementation_surfaces:
  - micro-specs/foundation/qa-harness-self-tests.md
  - tests/scripts/qa-tag-audit.test.ts
  - tests/scripts/qa-changed-path-selector.test.ts
  - tests/scripts/qa-environment-guard.test.ts
  - tests/scripts/qa-pr-baseline.test.ts
  - tests/scripts/qa-secret-scan.test.ts
  - tests/scripts/qa-cleanup-registry.test.ts
related_docs:
  - docs/qa/foundation.md
  - docs/qa/pr-baseline.md
related_tests:
  - tests/scripts/qa-tag-audit.test.ts
  - tests/scripts/qa-changed-path-selector.test.ts
  - tests/scripts/qa-environment-guard.test.ts
  - tests/scripts/qa-pr-baseline.test.ts
  - tests/scripts/qa-secret-scan.test.ts
  - tests/scripts/qa-cleanup-registry.test.ts
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

# MS-foundation-qa-harness-self-tests — Self-test the QA harness scripts

## 1. Exact Goal and User-Visible Outcomes

The QA machinery that everything else trusts can no longer rot silently. The
2026-07-11 audit found the core harness scripts largely untested:
`scripts/qa/tag-audit.ts` (the ratchet), `changed-path-selector.ts` (what
PR-baseline runs), `environment.ts` (the fail-closed destructive/prod guard —
partially covered via `guarded-command.test.ts`), `pr-baseline.ts` (command
selection + failure classification), `secret-scan.ts`, and
`cleanup-registry.ts`. When this ships, each has a behavioral suite pinning its
contract — especially the fail-closed and misclassification edges (e.g. the
missing-setup classifier gap that let absent Playwright browsers read as
`product` failures).

## 2. Blast Radius

In scope: new test files under `tests/scripts/**` (and shared helpers under
`tests/qa/` if genuinely needed), this spec, and its evidence ledger.

Out of scope: the harness scripts themselves — defects found (misclassification
regexes, guard bypasses) are reported for a product-fix spec, with current
behavior pinned as KNOWN-ISSUE; existing tests (`tests/qa/guarded-command.test.ts`
stays authoritative for the runner).

## 3. Strict Constraints and Assumptions

- Test the scripts as modules where they export functions; where they are
  CLI-only, spawn them with controlled env/fixtures in temp dirs (pattern:
  existing `tests/scripts/*.test.ts` operational-script suites).
- The environment guard suite MUST cover: prod-ref blocklist rejection, empty
  `QA_ALLOW_DESTRUCTIVE` fail-closed, remote-URL auto-classification to
  staging-like, and every `QA_EXTERNAL_MUTATION_MODE` acceptance value.
- The tag-audit suite MUST cover: unknown-tag hard fail, over-baseline fail,
  under-baseline pass, and new-file-with-tagged-titles pass.
- The changed-path-selector suite pins path→command selection for
  representative diffs (UI file → browser smoke; server file → API smoke; docs →
  prettier), and the pr-baseline classifier maps browser-binary-missing output to
  `missing-setup` (pin current behavior if it misclassifies; mark KNOWN-ISSUE).
- Deterministic; offline; accurate tags; ratchet green.

## 4. Decisions Already Made

- Suites live in `tests/scripts/` beside the existing operational-script tests.
- No harness script is modified here, even for confirmed bugs.

## 5. Behavioral Requirements (EARS)

- THE six harness scripts SHALL each have a behavioral suite pinning their
  contract edges as listed.
- IF a suite confirms a harness defect, THEN THE behavior SHALL be pinned with a
  KNOWN-ISSUE marker and reported.
- THE suites SHALL run offline and deterministically under `pnpm test`.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- All new suites pass under `pnpm test`; full suite green; tag guard green.
- All declared verification gates pass.

Tasks:

1. Environment guard + tag-audit suites (the two load-bearing ratchets).
2. Changed-path-selector + pr-baseline classification suites.
3. Secret-scan + cleanup-registry suites.
4. Record gates via `governance:run-gates --spec MS-foundation-qa-harness-self-tests --record`;
   advance lifecycle.

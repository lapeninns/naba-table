---
spec_id: MS-foundation-coverage-ratchet
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/foundation/**
  - micro-specs/evidence/**
  - package.json
  - pnpm-lock.yaml
  - vitest.config.ts
  - scripts/qa/**
  - config/qa/**
  - tests/qa/**
  - docs/qa/**
  - .github/workflows/test-suite.yml
  - coverage/**
implementation_surfaces:
  - micro-specs/foundation/coverage-ratchet.md
  - package.json
  - vitest.config.ts
  - scripts/qa/coverage-ratchet.ts
  - config/qa/coverage-baseline.json
  - tests/qa/coverage-command.test.ts
  - docs/qa/coverage.md
  - .github/workflows/test-suite.yml
related_docs:
  - docs/qa/README.md
  - docs/qa/full-suite.md
related_tests:
  - tests/qa/coverage-command.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
  - pnpm guard:coverage
  - pnpm lint
  - pnpm typecheck
  - pnpm run qa:foundation
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - A coverage run output plus a demonstration that lowering coverage fails the ratchet.
approved_exceptions: []
---

# MS-foundation-coverage-ratchet — Coverage measurement with ratcheting baseline

## 1. Exact Goal and User-Visible Outcomes

Test coverage becomes a measured, machine-enforced number instead of a feeling. Today
no coverage tooling exists anywhere (no provider dependency, no config, no script, no
CI step) — "we haven't covered all the edge cases" is invisible. When this ships:
`pnpm test:coverage` produces per-directory V8 coverage; a frozen baseline
(`config/qa/coverage-baseline.json`, same ratchet philosophy as the tag and luma
baselines) fails `pnpm guard:coverage` if coverage drops below the recorded floor;
and the full-suite CI workflow runs the coverage-guarded suite so the floor only ever
rises.

## 2. Blast Radius

In scope: `@vitest/coverage-v8` dev dependency (`package.json` + `pnpm-lock.yaml`);
a `coverage` block in `vitest.config.ts` (provider, reporters, sensible excludes —
must not affect non-coverage runs); `test:coverage` and `guard:coverage` scripts;
`scripts/qa/coverage-ratchet.ts`; the generated `config/qa/coverage-baseline.json`;
the coverage step in `.github/workflows/test-suite.yml`; self-test
`tests/qa/coverage-command.test.ts`; `docs/qa/coverage.md`; this spec + evidence.

Out of scope: raising coverage itself (the closure specs do that); per-file
thresholds (directory-level floors first); Playwright/e2e coverage; all product
source; other workflows.

## 3. Strict Constraints and Assumptions

- The dependency must be added with an exact-compatible version for vitest 4.1.0 and
  installed via pnpm; the lockfile change is part of this spec's radius.
- Coverage config must not change `pnpm test` behavior or timing (coverage only
  activates under `--coverage`).
- Baseline floors are generated from the real current numbers minus a small epsilon
  (e.g. 0.2 percentage points) so unrelated line-count drift doesn't flake the gate;
  the ratchet script must support `--update-baseline` that only ever RAISES floors
  (mirroring `guard:luma:update-baseline` ergonomics but strictly monotonic).
- Scope the measured tree to code the Vitest suite can exercise (exclude
  `tests/**`, `node_modules`, generated types, storybook, `.next`, config files);
  keep excludes explicit and documented.
- CI budget: the coverage run replaces the plain suite step only if total runtime
  stays under ~4 minutes; otherwise run coverage as a second step after the fast
  suite.

## 4. Decisions Already Made

- Provider: `@vitest/coverage-v8` (native V8, no instrumentation build step).
- Reporters: `text-summary` (human) + `json-summary` (ratchet input).
- Ratchet granularity: global + per-top-level-directory (`server`, `lib`, `src`,
  `components`, `hooks`, `reserve`, `cloudflare`, `scripts`) on lines and branches.
- Ratchet script lives in `scripts/qa/` beside the tag audit it imitates;
  `guard:coverage` = run coverage then compare against baseline.
- Self-test asserts: scripts exist, baseline file parses with floors > 0, workflow
  contains the coverage step, and the ratchet script rejects a lowered floor.

## 5. Behavioral Requirements (EARS)

- THE repository SHALL define `test:coverage` producing V8 coverage with
  `json-summary` output.
- THE repository SHALL define `guard:coverage` that fails when any tracked scope's
  lines or branches coverage falls below the frozen baseline floor.
- WHEN the full-suite CI workflow runs, THE workflow SHALL execute the
  coverage-guarded suite so a coverage drop fails CI.
- WHERE floors are updated, THE update path SHALL only raise floors, never lower
  them.
- IF the coverage summary is missing or unparseable, THEN THE guard SHALL fail
  closed rather than pass silently.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- `pnpm test:coverage` completes with a summary; `pnpm guard:coverage` passes on the
  fresh baseline.
- Temporarily raising a floor above reality makes `guard:coverage` fail (negative
  proof), then the real baseline is restored.
- `pnpm test` runtime is unchanged (coverage off by default).
- All declared verification gates pass.

Tasks (test-first):

1. Red: `tests/qa/coverage-command.test.ts`.
2. Green: dependency + vitest coverage block + scripts + ratchet + generated
   baseline + CI step.
3. Negative proof + docs (`docs/qa/coverage.md`).
4. Record gates and advance lifecycle.

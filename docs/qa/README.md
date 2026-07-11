# QA Documentation Index

How testing works in this repo, per layer:

- [full-suite.md](full-suite.md) — `pnpm test`: the complete non-e2e Vitest suite and
  its CI gate on every PR and push to `main` (`.github/workflows/test-suite.yml`).
- [coverage.md](coverage.md) — `test:coverage` / `guard:coverage`: V8 coverage with a
  ratcheting per-directory baseline (`config/qa/coverage-baseline.json`), enforced in
  the test-suite workflow.
- [e2e-smoke.md](e2e-smoke.md) — `.github/workflows/e2e-smoke.yml`: the three
  unauthenticated browser smoke packs gating every PR and push to `main`.
- [nightly.md](nightly.md) — `.github/workflows/nightly-qa.yml`: scheduled nightly
  `qa:rc` run with uploaded artifacts.
- [foundation.md](foundation.md) — `qa:foundation`: tag audit + QA harness self-tests;
  the guard/ratchet machinery (tags, guarded commands, artifact sanitizing).
- [pr-baseline.md](pr-baseline.md) — `qa:pr-baseline`: changed-path-scoped PR
  verification (build, lint, typecheck, selective smoke).
- [release-candidate.md](release-candidate.md) — `qa:rc`: the aggregated
  release-candidate pack (build, static, P0/P1 API+browser, workers, a11y/visual,
  privacy, performance, artifact safety).

Domain packs (each `qa:<domain>` script pairs a guarded `:api` Vitest slice with a
`:browser` Playwright slice where applicable):

- [background-workers.md](background-workers.md)
- [capacity-tables.md](capacity-tables.md)
- [customers-delivery.md](customers-delivery.md)
- [gbp-dual-sync.md](gbp-dual-sync.md)
- [observability-privacy.md](observability-privacy.md)
- [onboarding.md](onboarding.md)
- [performance.md](performance.md)
- [reserve-app.md](reserve-app.md)
- [settings-team.md](settings-team.md)
- [ui-regression.md](ui-regression.md)

The 100% QA program (pillars, audit snapshot, phased roadmap) is defined in the
repo-root [Goal.md](../../Goal.md).

You are working in `/Users/amankumarshrestha/LapenInns Project/nabatableLP`.

Goal: bring this repo to 100% QA — every product surface covered by tests, every push forced through them — while preserving existing product behavior, backend contracts, permissions, and the fail-closed QA safety model.

"100% QA" is met when all six pillars hold:

1. **Green baseline.** The full Vitest suite and all Playwright packs pass on `main` at all times. A red `main` is a stop-the-line event.
2. **Full-suite gate.** CI runs the complete Vitest suite (~3,374 tests, ~40s) on every PR **and every push to `main`** — direct pushes must not bypass tests.
3. **Browser QA in CI.** Playwright browsers are installed in CI; guest + ops + reserve browser packs gate PRs (smoke) and run fully on a schedule.
4. **Coverage is measured and ratcheted.** `@vitest/coverage-v8` reports per-directory coverage; a frozen baseline (same pattern as the tag/luma ratchets) only ever tightens.
5. **Nightly RC run.** A scheduled workflow runs the `qa:rc` release-candidate pack (mock/local mode) nightly and uploads artifacts, so drift surfaces within a day even with no PR open.
6. **Surface coverage closed.** The gap list below is driven to zero, highest risk first; DB-level invariants (RLS, atomicity, tenant isolation) get real-Postgres tests as AGENTS.md already mandates.

Before editing, read and follow:

1. `AGENTS.md` (binding: micro-spec governance + TDD workflow)
2. `micro-specs/README.md` and `micro-specs/GLOBAL_CONTEXT.md`
3. `docs/sdlc/verification.md` (change-type verification matrix)
4. `docs/qa/README.md` and the per-pack docs in `docs/qa/*.md`
5. `Instructions_tdd.md`

Non-negotiables:

- Do not leak or print secrets.
- Supabase is remote-only; tests stay mocked/local by default. Never weaken the fail-closed env guard (`scripts/qa/environment.ts`, `run-guarded-command.ts`) or its production blocklist.
- New QA tooling (CI workflows, coverage config, runner scripts) goes through the micro-spec governance like any other work.
- Respect the existing ratchets (`config/qa/tag-baseline.json`, luma baseline): baselines may tighten, never loosen.
- Do not delete or quarantine failing tests to get green — diagnose and fix product code or update stale expectations with evidence.
- New tests must be deterministic: no host-timezone, wall-clock, or timing dependence (pin TZ, use fake timers).

Audit snapshot (2026-07-11, `main` @ 4763635d) — the starting line:

- Full suite: 3,363/3,374 passing; **11 failures in 6 files** (booking-lifecycle regression pushed to `main` the same day + component-test debt). Typecheck clean.
- CI gates: PR-only; no workflow runs the full suite, no Playwright browsers installed, no coverage, no scheduled runs. `ai-governance.yml` is the only push-to-main workflow and runs no product tests.
- QA packs exercise ~180 curated test files; **575 of 755 test files belong to no pack** (they run only under a bare `vitest run` / `playwright test`, which nothing invokes).
- Untested surface: API routes ~11 of 145 (+ onboarding per-step cluster); server/lib modules 160/578; components 377/548 (restaurant-settings 119/179, dashboard 52/66, menu 28/29); hooks 49/76; reserve features ~83% of files; **supabase: 0 SQL-level tests across 106 migrations / ~70 functions**; e2e missing for `dashboard/print` and `new-bookings` pages; the `scripts/qa` harness itself is largely untested.
- Tag debt: 91 of 3,343 test titles tagged; quarantine list empty; zero `.skip`.

Roadmap (execute in order; each phase is a separate PR-sized slice):

- **Phase 0 — restore green.** Fix the 11 failures on `main` (diagnose regression vs stale test per cluster; the 5 server failures trace to the 4763635d booking-lifecycle commit and may be a live guest-facing bug).
- **Phase 1 — enforce.** `test` script + full-suite CI workflow on PR + push to `main`; add Playwright browser install; wire browser smoke packs into CI.
- **Phase 2 — measure.** Coverage tooling + per-directory ratchet baseline; report in CI.
- **Phase 3 — schedule.** Nightly `qa:rc` workflow with artifact upload.
- **Phase 4 — close the gaps.** Work the untested-surface list top-down by risk: booking/capacity/auth API routes → supabase SQL-level invariant tests (pgTAP or staging-shadow harness) → monthly-report + google-business-profile server clusters → ops hooks → restaurant-settings/dashboard component trees → reserve features. Tag new tests (`@p0`…) as you go.
- **Phase 5 — self-test the harness.** Tests for `scripts/qa/*` (pr-baseline selector, rc-pack, tag-audit, environment guard) so the QA system can't silently rot.

Validation commands:

```bash
pnpm exec vitest run                 # full unit/integration suite (must stay green)
pnpm run typecheck && pnpm run lint
pnpm run qa:foundation               # QA harness self-checks
pnpm run guard:qa-tags
pnpm exec playwright test            # e2e (per-config: playwright.config.ts / .app / .reserve)
pnpm run qa:rc                       # full release-candidate pack (local, mocked)
```

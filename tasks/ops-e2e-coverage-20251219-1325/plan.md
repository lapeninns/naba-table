# Plan

## Phase 1 — Requirements

- Enumerate ops routes from `src/app/app/(app)` and middleware redirects.
- Confirm ops sign-in path and required env secrets.

## Phase 2 — Plan

- Add ops auth Playwright fixture using email/password.
- Add ops route coverage spec (`@ops @smoke`).
- Add ops redirect coverage spec (`@ops @smoke`).
- Update E2E README and CI workflow envs.

## Phase 3 — Implement

- Create `tests/e2e/fixtures/ops-auth.fixture.ts`.
- Create `tests/e2e/ops/ops-routes.spec.ts` and `tests/e2e/ops/ops-redirects.spec.ts`.
- Update `.github/workflows/e2e.yml` to pass ops secrets.
- Update `tests/e2e/README.md` coverage + env vars.

## Phase 4 — Verify

- Run Playwright in CI and record results in `verification.md`.

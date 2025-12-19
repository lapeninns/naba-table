---
task: run-e2e-ci
timestamp_utc: 2025-12-19T11:30:43Z
owner: github:@amankumarshrestha
reviewers: [github:@qa]
risk: medium
flags: []
related_tickets: []
---

# Research: Run full Playwright E2E suite in CI/staging

## Requirements

- Run the full Playwright E2E suite (tests/e2e) across all configured projects.
- Execute in CI/staging environment (not local).
- Capture artifacts (report, traces/screenshots) for review.

## Existing Patterns & Reuse

- Playwright config: `playwright.config.ts` defines projects (chromium, firefox, webkit, mobile-chrome) and uses `BASE_URL`.
- Guest auth fixture uses `/api/auth/e2e-login` and requires `E2E_TEST_TOKEN` on the server plus `E2E_GUEST_SESSION_TOKEN` in the test runner.
- Existing CI workflow `.github/workflows/ci.yml` does not run E2E tests.

## Required Env / Secrets (for CI)

- `BASE_URL` (staging/preview URL).
- `E2E_GUEST_SESSION_TOKEN` (must match server `E2E_TEST_TOKEN`).
- `E2E_TEST_GUEST_EMAIL`, `E2E_TEST_GUEST_NAME` (test user).
- `E2E_TEST_RESTAURANT_SLUG` (restaurant slug present in target env).

## Constraints & Risks

- Staging must have `E2E_TEST_TOKEN` configured server-side; otherwise `/api/auth/e2e-login` returns 403.
- Tests assume guest user and restaurant slug exist or can be created.
- E2E suite can be long; should be workflow_dispatch or labeled gate.

## Recommended Direction

- Add a dedicated GitHub Actions workflow to run full Playwright E2E suite against a provided `BASE_URL` and secrets.
- Trigger via GH CLI or Actions UI after secrets are configured.

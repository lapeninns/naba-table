# Playwright Test Suite

This directory hosts end-to-end, component, and helper utilities for Playwright.

- `e2e/` — browser-based flows grouped by domain (wizard, profile, payments, reservations).
- `component/` — Playwright Component Testing (React) specs.
- `fixtures/` — shared fixtures (authentication, data factories) and `.auth/` storage state snapshots.
- `helpers/` — utilities for selectors, accessibility, visual, and performance instrumentation.
- `mocks/` — reserved for HAR recordings or mocked service responses.
- `visual/` — baseline screenshots for visual regression diffing.

## Environment setup

1. Start the Next.js app with the following additions (recommended via `.env.playwright`):
   - `NEXT_PUBLIC_RESERVE_V2=true`
   - `NEXT_PUBLIC_ENABLE_TEST_UI=true` (exposes confirmation download button)
   - `STRIPE_MOCK_MODE=true` (enables deterministic checkout responses)
   - `ENABLE_TEST_API=true` (allows `/api/test/*` helpers)
   - Optional: `TEST_ROUTE_API_KEY=super-secret` to require an auth header for test APIs.

2. Export Playwright helpers as needed:
   - `PLAYWRIGHT_AUTH_EMAIL`, `PLAYWRIGHT_AUTH_PASSWORD`, `PLAYWRIGHT_AUTH_NAME`, `PLAYWRIGHT_AUTH_PHONE` control the seeded account.
   - `PLAYWRIGHT_TEST_API_KEY` should match `TEST_ROUTE_API_KEY` when set. The global setup passes it automatically to the test endpoints.
   - `PLAYWRIGHT_AUTH_REFRESH=true` forces regeneration of the storage state on the next run.

3. The global setup hits `/api/test/playwright-session` to create a Supabase user + session and saves storage in `tests/.auth/default.json`. Provide your own storage via `PLAYWRIGHT_AUTH_STATE_PATH` or `PLAYWRIGHT_AUTH_STATE_JSON` if preferred.

4. Test data helpers:
   - `/api/test/bookings` seeds a confirmed reservation for download/detail coverage.
   - `/api/test/leads` cleans up emails created by the lead capture API tests.
   - `/api/test/reservations/:id/confirmation` serves a deterministic PDF for download checks.

See `package.json` scripts for entry points and `playwright.config.ts` for project configuration.

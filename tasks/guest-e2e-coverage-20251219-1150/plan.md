# Plan

## Phase 1 — Requirements

- Identify guest-facing routes missing from Playwright coverage (public, guest portal, booking confirmation, redirects).
- Confirm which routes exist in `src/app` and which redirects are defined in `next.config.js`.

## Phase 2 — Plan

- Add a new guest route coverage spec tagged `@guest @smoke` to validate route availability and key UI markers.
- Add a minimal redirect coverage spec tagged `@guest @smoke` that asserts canonical redirects.
- Extend a11y/visual suites only if essential for route coverage; otherwise keep functional coverage focused.
- Document tags used: `@guest` for guest-facing flows, `@smoke` for lightweight route checks.

## Phase 3 — Implement

- Create `tests/e2e/guest/guest-routes.spec.ts` for public + guest portal route checks.
- Create `tests/e2e/guest/guest-redirects.spec.ts` for canonical redirects.
- Use authenticated `guestPage` where required; use plain `page` for public routes.

## Phase 4 — Verify

- Run Playwright E2E (local or CI) and record results in `verification.md`.
- If local E2E is blocked, document the failure and reference CI workflow trigger instructions.

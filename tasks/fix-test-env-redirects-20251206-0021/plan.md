---
task: fix-test-env-redirects
timestamp_utc: 2025-12-06T00:22:01Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Stabilize test env domains & redirects

## Objective

Align auth/ops unit tests and E2E flows with environment-driven domains so tests no longer fail due to localhost vs production URLs, and ensure middleware allows Playwright traffic without redirect loops.

## Success Criteria

- [ ] Auth route unit tests assert against the env-configured root domain and pass under `pnpm test`.
- [ ] Ops occasions route test no longer returns 500; `requireOpsAuth` mocked and test passes.
- [ ] Playwright wizard/booking flows reach intended pages (no redirect to `/`).
- [ ] Auth E2E fixture returns redirectUrl matching test expectation (e.g., `/guest/bookings`) and does not bounce to home.
- [ ] Production behavior unchanged (redirect logic still enforces intended rules for real hosts).

## Architecture & Components

- Env handling: prefer `process.env.NEXT_PUBLIC_ROOT_DOMAIN` in tests; ensure fallbacks avoid prod domains when running locally.
- Auth tests: update expectations in `src/app/api/auth/signin/route.test.ts` and `callback/route.test.ts` to read env value (with default `http://localhost:3000`).
- Ops occasions test: mock `requireOpsAuth` (likely from `@/services/ops/auth` or similar) to return an authenticated ops context; stub Supabase if needed.
- Middleware: adjust host/pathname allowlist for test host/port used by Playwright; consider UA guard if available.
- Auth fixture: ensure `/api/auth/e2e-login` returns redirectUrl consistent with test base path.

## Data Flow & API Contracts

- `/api/auth/signin` and `/api/auth/callback` should generate URLs based on `NEXT_PUBLIC_ROOT_DOMAIN`; tests will assert against runtime env.
- `/api/ops/occasions` requires authenticated ops user; test mock should short-circuit external DB calls.
- `/api/auth/e2e-login` should issue redirectUrl to target guest bookings page.

## UI/UX States

- N/A (backend + middleware), but middleware must allow booking pages for test host.

## Edge Cases

- `VERCEL_URL` set in CI might override root domain; ensure tests either unset or assert based on computed value.
- Playwright baseURL port difference (e.g., 4173) should still be accepted by middleware.
- Middleware changes must not open routes to unauthenticated real users; scope to test host/UA.

## Testing Strategy

- Unit: `pnpm test src/app/api/auth/signin/route.test.ts src/app/api/auth/callback/route.test.ts src/app/api/ops/occasions/route.test.ts`.
- Integration/E2E: `pnpm test:e2e` or targeted Playwright spec for wizard/booking flow.
- Optional: run single Playwright test after middleware change to confirm no redirect loop.

## Rollout

- No feature flag needed; changes are test- and host-scoped.
- Monitor CI for unit/E2E green; no production rollout actions.

## DB Change Plan

- None (no schema changes).

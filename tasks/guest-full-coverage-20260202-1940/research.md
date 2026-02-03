---
task: guest-full-coverage
timestamp_utc: 2026-02-02T19:40:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest-facing test coverage expansion

## Requirements

- Functional:
  - Cover all guest-facing routes across public marketing, booking flow, auth, and guest portal surfaces.
  - Use Playwright E2E for guest-facing routes where mocks suffice; add unit/integration tests for DB-backed routes and guest view models.
  - Keep tests organized as `tests/e2e/guest-*.spec.ts` grouped by area.
  - Hybrid data strategy: mocked APIs where possible; live data only if required (avoid hard dependency on Supabase in E2E).
- Non-functional:
  - Follow existing accessibility expectations for UI assertions.
  - Avoid introducing new dependencies.

## Existing Patterns & Reuse

- E2E mocks live in `tests/e2e/guest-booking*.spec.ts`, `tests/e2e/guest-reserve-routes.spec.ts`, `tests/e2e/guest-public-pages.spec.ts`.
- Guest portal view models live in `src/guest/routes/**/view-model.ts` and require `services.auth.requireUser`.
- Public restaurant pages use Supabase (`listRestaurants`, `getRestaurantBySlug`) and are not deterministic in Playwright’s dummy env.

## Constraints & Risks

- Playwright dev server sets Supabase env to localhost placeholders; DB-backed pages will fail in E2E without mocks.
- Guest portal requires authenticated Supabase session; E2E can cover redirect behavior when unauthenticated.
- Avoid reliance on live secrets in tests.

## Recommended Direction

- Add E2E specs for public marketing/auth pages and guest portal redirects (unauthenticated path).
- Add unit/integration tests to cover DB-backed public pages and guest view models (mock server services).
- Expand existing E2E specs with missing redirect/thank-you coverage.

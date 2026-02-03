---
task: guest-full-coverage
timestamp_utc: 2026-02-02T19:40:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest-facing test coverage expansion

## Objective

Ensure every guest-facing route has automated coverage, using E2E for mockable paths and unit/integration tests for DB-backed pages and guest view models.

## Success Criteria

- [ ] E2E coverage includes public landing/auth pages, booking redirects, and guest portal redirects.
- [ ] Unit/integration tests cover DB-backed public restaurant pages and guest view models.
- [ ] Guest-facing tests remain organized in `tests/e2e/guest-*.spec.ts` by area.
- [ ] `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm test` pass.

## Architecture & Components

- Add E2E specs:
  - `guest-public-marketing.spec.ts` (landing, privacy, restaurant thank-you redirects).
  - `guest-auth-pages.spec.ts` (role selection + guest sign-in UI).
  - `guest-portal-redirects.spec.ts` (unauthenticated redirects for guest dashboard/profile/bookings).
- Extend existing E2E specs for booking/manage redirect coverage.
- Add unit/integration tests for:
  - `src/app/(public)/(marketing)/restaurants/page.tsx` (list) with mocked `listRestaurants`.
  - `src/app/(public)/(marketing)/restaurants/[slug]/page.tsx` (detail) with mocked `getRestaurantBySlug`.
  - `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx` (wizard wrapper) with mocked data + `notFound`.
  - Guest view models (`src/guest/routes/**/view-model.ts`).

## Data Flow & API Contracts

- Mock `/api/restaurants/**` and `/api/bookings/**` where needed in E2E (existing patterns).
- Unit tests mock Supabase-backed data access to avoid live DB dependencies.

## UI/UX States

- Assert key headings/CTAs for marketing/auth pages.
- Validate redirect targets for protected guest routes and legacy booking links.

## Testing Strategy

- E2E (Playwright): public marketing/auth, booking redirects, guest portal redirects.
- Unit/integration (Vitest): guest view models and DB-backed public restaurant pages.

## Rollout

- No runtime changes; tests only.

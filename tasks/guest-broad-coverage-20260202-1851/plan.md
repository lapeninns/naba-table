---
task: guest-broad-coverage
timestamp_utc: 2026-02-02T18:51:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Broader guest E2E coverage

## Objective

Expand Playwright coverage across guest-facing pages using mocked APIs to validate critical happy paths without staging dependencies.

## Success Criteria

- [ ] New guest E2E specs cover reserve routes (root/new/slug/not-found/reservation stub) and public booking landing/recovery pages.
- [ ] Mocked APIs for restaurant list/detail, availability schedule, and booking lookups/history are exercised via UI + request assertions.
- [ ] `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm test` pass.

## Architecture & Components

- Add new Playwright spec(s) under `tests/e2e/`.
- Reuse route intercept patterns from existing guest specs to stub:
  - `/api/restaurants/**` (calendar mask + schedule + list/detail as needed)
  - `/api/bookings` list/create
  - `/api/bookings/:id` detail/update/cancel
- Cover static public pages under `src/app/(public)/bookings/**` that do not require Supabase data.
- Add a mocked API coverage spec that mixes UI interactions with direct `fetch` assertions.

## UI/UX States

- Reserve routes: plan step heading renders; reservation stub shows id; not found page guidance visible.
- Public bookings: landing page actions visible; recovery error copy matches code.

## Testing Strategy

- Playwright E2E (Chromium only) with deterministic mocks.
- Reuse existing booking IDs and mock state transitions for reserve flows.
- Note exclusions for DB-backed marketing/restaurant pages.

## Rollout

- No feature flags; test-only change.

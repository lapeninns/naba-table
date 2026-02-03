---
task: guest-broad-coverage
timestamp_utc: 2026-02-02T18:51:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Broader guest E2E coverage

## Requirements

- Functional:
  - Add Playwright E2E coverage for guest-facing pages beyond booking manage using mocked APIs.
  - Cover reserve app routes (root/new/slug/confirmation stub, not found) plus public bookings landing/recovery pages.
  - Exercise mocked API groups: restaurant list/detail, availability schedule, booking lookup/history.
  - Use mocked API responses for determinism (no staging/DB access).
  - Chromium-only runs.
- Non-functional:
  - Keep tests deterministic and fast.
  - Avoid new dependencies.

## Existing Patterns & Reuse

- `tests/e2e/guest-booking.spec.ts` and `tests/e2e/guest-booking-manage.spec.ts` already stub `/api/restaurants` and `/api/bookings` endpoints.
- `playwright.config.ts` defines base URLs and web servers for reserve + Next.
- Reserve routes live in `reserve/app/routes.tsx` (root/new/slug/reservationId/not-found).
- Public bookings landing and recovery pages are static (`src/app/(public)/bookings/**`).

## Constraints & Risks

- Mocked API responses must align with UI expectations (avoid 401 redirects).
- Avoid introducing new auth flows or relying on emails.
- Marketing/restaurant pages depend on server-side Supabase data and are not deterministic without staging.

## Recommended Direction

- Create new Playwright specs that reuse existing mock patterns for reserve routes and static public booking pages.
- Document exclusions for DB-backed marketing/restaurant pages.
- Add a mocked API coverage spec using UI interactions plus direct request assertions.

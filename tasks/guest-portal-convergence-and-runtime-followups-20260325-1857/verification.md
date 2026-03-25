---
task: guest-portal-convergence-and-runtime-followups
timestamp_utc: 2026-03-25T18:57:00Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Portal harnesses

- [x] Dashboard harness
  - `/dev/guest-dashboard?fixture=default` renders the shared portal hero, upcoming booking card, stats, and portal actions against deterministic mocked data.
  - Fresh isolated-console sample showed PostHog/debug logs only; no app-level runtime errors on the harness page.
- [x] Bookings harness
  - `/dev/guest-bookings?fixture=default&tab=history` canonicalizes to `tab=past` and renders the past-bookings panel with Orchard House and Harbor Table fixtures.
- [x] Profile harness
  - `/dev/guest-profile?fixture=default&mutation=success` keeps email visible/disabled, validates inline errors, and supports deterministic success/error save feedback through the client-side harness.

### Booking entry console/noise check

- [x] `/restaurants/[slug]/book` console is free of avoidable app-owned warnings in the validated flow
  - Initial DevTools work identified two real local issues on `/restaurants/the-fox/book`: repeated `schedule` `500`s for the fallback fixture restaurant and a `Select is changing from uncontrolled to controlled` warning after time suggestions hydrated.
  - The follow-up fix added a dev-only fixture schedule/calendar fallback for the public fixture restaurant, removed the public booking page’s extra `next/dynamic` wrapper, and locked the time select to a controlled empty-string state.
  - Final live-browser rerun on `http://localhost:3000/restaurants/the-fox/book` showed:
    - `badResponses: []`
    - no uncontrolled/controlled select warning
    - only expected local dev noise from PostHog/HMR logs
  - Artifact: `artifacts/booking-entry-browser-check.json`

### Accessibility snapshot

- Lighthouse snapshot on `/dev/guest-dashboard?fixture=default` (mobile):
  - Accessibility: `92`
  - Best Practices: `100`
  - SEO: `100`
  - Lighthouse flagged follow-up items for color contrast, heading order, and missing main landmark on the harness snapshot.

## Test Outcomes

- [x] Focused Vitest
  - `npx vitest run tests/guest/guest-view-models.test.ts tests/guest/guest-bookings-params.test.ts --reporter=verbose`
  - Result: `2` files, `8` tests passed
- [x] Fixture/runtime helper Vitest
  - `npx vitest run tests/server/restaurants/devBookingFixture.test.ts --reporter=verbose`
  - Result: `1` file, `3` tests passed
- [x] Focused Playwright
  - `PLAYWRIGHT_DEV_HARNESS=1 npx playwright test tests/e2e/guest-mocked-api-coverage.spec.ts tests/e2e/guest-booking.spec.ts tests/e2e/guest-booking-manage.spec.ts --reporter=list`
  - Result: `7` tests passed
- [x] Booking-entry Playwright rerun
  - `PLAYWRIGHT_DEV_HARNESS=1 npx playwright test tests/e2e/guest-reserve-routes.spec.ts tests/e2e/guest-booking.spec.ts --reporter=list`
  - Result: `3` tests passed
- [x] Typecheck
  - `pnpm typecheck`
- [x] Lint
  - `pnpm lint`
  - Result: passes with the same pre-existing `13` warnings in `lib/*` and `server/*`

## Artifacts

- Screenshots:
  - `artifacts/dev-guest-dashboard.png`
  - `artifacts/dev-guest-bookings.png`
  - `artifacts/dev-guest-profile.png`
  - `artifacts/guest-booking-route.png`
- Lighthouse:
  - `artifacts/report.json`
  - `artifacts/report.html`
  - `artifacts/booking-entry-browser-check.json`

## Known Issues

- `validate-live-apphost-guest-route-canonicalization` may remain blocked by the known local multi-host dev limitation.
- The earlier harness Lighthouse snapshot still flagged follow-up items for color contrast, heading order, and a missing main landmark on the dev harness page.

## Sign-off

- [x] Engineering

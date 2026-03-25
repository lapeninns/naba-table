---
task: guest-booking-lifecycle-validation-rerun
timestamp_utc: 2026-03-25T18:00:52Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP

### Public booking detail / recovery rerun

- [x] Unauthenticated public booking detail redirects to sign-in through the recovery path.
      Evidence: `/.factory/validation/guest-booking-lifecycle/user-testing/booking-detail-unauth-round11.png`
- [x] Authorized public booking detail renders correctly after recovery and exposes the correct lifecycle actions.
      Evidence: `/.factory/validation/guest-booking-lifecycle/user-testing/booking-detail-authorized-round11.png`
- [x] `Book Again` lands on the canonical restaurant booking-entry flow instead of a not-found page.
      Evidence: `/.factory/validation/guest-booking-lifecycle/user-testing/rebook-destination-round11.png`
- [x] Shared booking-detail loading/error states are browser-visible through the dev harness.
      Evidence: `/.factory/validation/guest-booking-lifecycle/user-testing/booking-detail-states-round11.png`

### Guest receipt rerun

- [x] Canonical guest receipt lifecycle UI is browser-visible through the new dev-only harness.
      Route: `http://localhost:3000/dev/guest-receipt?fixture=cancelled`
      Evidence: `/.factory/validation/guest-booking-lifecycle/user-testing/guest-receipt-harness-round12.png`
- [x] The historical local URL `http://localhost:3000/guest/bookings/33333333-3333-4333-8333-333333333333/receipt?token=abc123` still shows the receipt error state, but this is now a missing-data/runtime limitation rather than the deprecated-token branch.
      Evidence: `/.factory/validation/guest-booking-lifecycle/user-testing/guest-receipt-missing-seed-round12.png`
      Supporting artifact: `/tasks/guest-booking-lifecycle-validation-rerun-20260325-1800/artifacts/receipt-token-runtime-check.txt`

## Test Outcomes

- [x] Focused Vitest:
  - `npx vitest run tests/guest/public-booking-pages.test.tsx tests/guest/guest-receipt-pages.test.tsx --reporter=verbose`
- [x] Focused Playwright:
  - `PLAYWRIGHT_DEV_HARNESS=1 npx playwright test tests/e2e/guest-receipt-pages.spec.ts --workers=1`
- [x] Full Vitest:
  - `npx vitest run --maxWorkers=9`
  - Result: 61 files / 287 tests passed
  - Notes: pre-existing noisy stderr warnings remain from unrelated tests (`act(...)`, canvas `getContext`, duplicate GoTrue client)
- [x] Typecheck:
  - `pnpm typecheck`
- [x] Lint:
  - `pnpm lint`
  - Result: 13 pre-existing warnings only in unrelated `lib/*` and `server/*` files

## Artifacts

- Screenshots:
  - `/.factory/validation/guest-booking-lifecycle/user-testing/booking-detail-unauth-round11.png`
  - `/.factory/validation/guest-booking-lifecycle/user-testing/booking-detail-authorized-round11.png`
  - `/.factory/validation/guest-booking-lifecycle/user-testing/rebook-destination-round11.png`
  - `/.factory/validation/guest-booking-lifecycle/user-testing/booking-detail-states-round11.png`
  - `/.factory/validation/guest-booking-lifecycle/user-testing/guest-receipt-harness-round12.png`
  - `/.factory/validation/guest-booking-lifecycle/user-testing/guest-receipt-missing-seed-round12.png`
- Runtime note:
  - `/tasks/guest-booking-lifecycle-validation-rerun-20260325-1800/artifacts/receipt-token-runtime-check.txt`

## Known Issues

- The connected remote dataset for local validation does not contain bookings `33333333-3333-4333-8333-333333333333`, `44444444-4444-4444-8444-444444444444`, or `55555555-5555-4555-8555-555555555555`, so the legacy `?token=abc123` receipt example cannot render live data locally.
- The browser-facing receipt validation is therefore covered by the new dev-only harness while the production/shared receipt code path remains fixed and tested.

## Sign-off

- [x] Engineering

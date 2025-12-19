---
task: qa-regression-guest-profile
timestamp_utc: 2025-12-05T14:25:12Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Not applicable (no UI change); focus on automated E2E results.

## Test Outcomes

- Playwright guest suite (latest run with build using `NEXT_PUBLIC_SITE_URL=http://localhost:3001`): **FAILED** (3 passed, 2 failed) via `BASE_URL=http://localhost:3001 E2E_GUEST_SESSION_TOKEN=local-dev-token pnpm test:e2e:guest`.
- Key checks: ProfileManageForm label assertions still pass (accessibility fix verified); auth bypass unstable (see Observations); booking flows still fail.
- Failures:
  - Guest Booking CRUD › Full Booking Lifecycle › CREATE: booking CTA button not visible within 10s → wizard cannot start.
  - Booking Validation › should prevent booking without required fields: submit button did not report disabled within 15s.

## Artifacts

- Latest console log: `test-results/guest-e2e-20251205-1450.log` (prior logs were cleared by Playwright).
- Failure artifacts:
  - `test-results/guest-booking-crud-Guest-B-743ac-full-booking-CRUD-lifecycle-chromium/test-failed-1.png`
  - `test-results/guest-booking-crud-Booking-e402f-ing-without-required-fields-chromium/` (screenshot, video.webm, error-context.md)
- Server log copy (latest run): `test-results/server-20251205-1450.log` (contains repeated auth failures and 401 from /api/bookings prefetch).

## Known Issues

- Booking CTA button absent/hidden prevents CRUD flow start (guest booking), even after rebuilding with site URL set to port 3001.
- Validation test timing out waiting for disabled state on booking submit.
- SSR prefetch for `/guest/bookings` now failing with 401 (missing/invalid auth session), indicating e2e-login cookies are not consistently honored by API requests.

## Sign-off

- Pending after failures addressed.

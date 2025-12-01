---
task: restaurant-ops-qa
timestamp_utc: 2025-11-30T23:41:24Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Restaurant Ops QA Findings

## High Priority

- **Bookings date filter ignored**: `/bookings?date=2030-01-01` still shows Dec 2025 bookings; cannot view true future empty state and risks acting on the wrong day. Screenshot: `artifacts/bookings-future.png`.
- **Floor-plan seating control broken**: "Walk-in Seating" button on a table does nothing (desktop, iPad, iPhone). Blocks seating a walk-in from the floor plan and prevents conflict/capacity validation flows.
- **Offline crash**: When network is set to Offline, navigation yields browser error page (`ERR_INTERNET_DISCONNECTED`); no in-app offline handling or cached view, leaving ops without guidance during Wi‑Fi drops.
- **Date consistency gap**: Dashboard accepts future date and shows empty state; Bookings view for same date does not—leading to cross-view inconsistency for the same service date.

## Low Priority

- **Mobile target size & density**: Floor plan on phone has tightly packed table buttons and a small time slider; likely <44px touch targets and requires horizontal scrolling, increasing mis-tap risk in service.
- **Minor CLS on slow network**: Bookings header/filters shift during hydration under Fast 3G; could cause missed taps.
- **Form validation UX**: Restaurant profile email relies on post-submit native alert; no inline/pre-submit hint and value silently reverts—confusing for staff.
- **A11y/test coverage gaps**: Keyboard-only walk-in flow and Lighthouse a11y audit not completed (auth-gated context). Recommend authenticated Lighthouse run and full tab-order check.

## Notes and Coverage

- Devices: Desktop (1280x800), iPad Pro (1024x1366), iPhone 12 (390x844).
- Network: Normal, Fast 3G (to observe hydration/CLS), Offline (to test resilience).
- Routes exercised: /dashboard, /bookings, /walk-in, /seating/floor-plan, /customers, /settings/restaurant/profile.
- Artifacts: `artifacts/bookings-future.png` (future-date bookings showing 2025 data).

## Open Risks / Follow-ups

- Cannot verify seat-conflict or over-capacity logic until floor-plan seating action works.
- Need larger datasets to stress scroll/memory on bookings/customers.
- Run authenticated Lighthouse a11y/perf and complete keyboard-only pass.

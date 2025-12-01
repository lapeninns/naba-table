---
task: restaurant-ops-qa
timestamp_utc: 2025-11-30T23:41:24Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Login to app.nabatable.com with provided credentials.
- [ ] Enable DevTools device + network emulation.

## Core

- [ ] Empty state checks for future date /dashboard & /bookings.
- [ ] List perf on /customers or /bookings with rapid scroll.
- [ ] Input validation in /settings/restaurant/profile.

## UI/UX

- [ ] Touch targets in /walk-in and /seating on mobile.
- [ ] Sidebar and tables layout on mobile/tablet.

## Concurrency/Logic

- [ ] Conflict booking existing occupied table.
- [ ] Capacity over-allocation.
- [ ] Rapid check-in/undo toggles.

## Network/Resilience

- [ ] Fast 3G nav; hydration/CLS watch.
- [ ] Offline handling behavior.

## Tests

- [ ] Lighthouse a11y snapshot.
- [ ] Keyboard-only /walk-in wizard.

## Notes

- Assumptions: credentials valid; environment stable.
- Deviations: None yet.

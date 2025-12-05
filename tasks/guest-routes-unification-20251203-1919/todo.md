---
task: guest-routes-unification
timestamp_utc: 2025-12-03T19:19:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create shared booking detail module for reuse.
- [x] Update route docs.
- [x] Remove `/auth/forgot-password` route; update links.

## Core

- [x] `/guest` renders dashboard content (remove redirect).
- [x] `/guest/bookings/:bookingId` renders booking detail without redirect.
- [x] Keep `/bookings/:bookingId` functional via shared module.
- [x] Confirm `guest/thank-you` present; remove stale 404 references.
- [x] Remove password-reset route and stale references.

## QA / Verification

- [x] Re-run route scanner to confirm new routes and absence of redirects.
- [ ] Note pending UI manual QA (Chrome DevTools) if not completed.

## Notes

- Assumption: Legacy `/bookings/:id` must remain for backward compatibility.
- Deviations: None yet.

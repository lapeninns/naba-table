---
task: public-marketing-clarity
timestamp_utc: 2025-12-10T18:21:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Inventory current public marketing and booking pages for copy density and CTAs
- [ ] Identify reusable components and locations to add inline SVGs

## Core

- [x] Simplify /restaurants listing copy and header
- [x] Simplify /restaurants/[slug] detail hero/sections
- [x] Tighten /restaurants/[slug]/book wizard copy/instructions
- [x] Simplify /restaurants/[slug]/book/thank-you messaging
- [x] Trim /bookings/[bookingId] public detail text
- [x] Trim /bookings/[bookingId]/manage management page
- [x] Ensure /auth/signin remains concise and clear

## UI/UX

- [ ] Keep primary CTAs obvious; maintain responsive layouts
- [ ] Add lightweight SVGs where helpful without new tokens
- [ ] Verify keyboard/focus and labels remain intact

## Tests

- [ ] Manual QA + axe on sampled pages
- [ ] Smoke booking flow

## Notes

- Assumptions: No required legal copy removal without confirmation.
- Deviations:

## Batched Questions

- Legal copy requirement? (see research open questions)

---
task: booking-journey-design-system-rebuild
timestamp_utc: 2026-04-11T19:54:58Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and align scope with `/GUEST_FACING_DESIGN_SYSTEM.md`
- [x] Record that `b1aKNEah8` is reference-only and guest-surface-scoped for this task
- [x] Update `CONTINUITY.md` with this redesign pass and working set

## Core

- [x] Rebuild `/bookings` as the public booking entry surface
- [x] Refresh the canonical wizard shell and step presentation for `/restaurants/[slug]/book`
- [x] Rebuild the thank-you surface used by `/restaurants/[slug]/book/thank-you`
- [x] Recompose booking detail and receipt shared shells for `/bookings/[bookingId]` and receipt target consistency
- [x] Rebuild `/bookings/recover/error`
- [x] Verify preserved redirect routes still point to the right targets

## UI/UX

- [x] Tonal layering replaces border-led sections
- [x] Glass treatment and editorial typography are consistent across routes
- [x] Loading, error, and empty states match the redesigned system
- [x] Keyboard and focus behavior stay intact on verified public surfaces

## Tests

- [x] Typecheck
- [ ] Any targeted tests/lint needed for edited booking components
- [x] Chrome DevTools verification and artifacts

## Notes

- Assumptions:
  - Shared receipt/detail surfaces count as relevant booking-journey components because preserved redirects land on them.
- Deviations:
  - Browser proof for `/bookings/[bookingId]` used the real auth redirect path because the managed detail surface is auth-gated locally and there is no dedicated detail harness yet.

## Batched Questions

- None yet.

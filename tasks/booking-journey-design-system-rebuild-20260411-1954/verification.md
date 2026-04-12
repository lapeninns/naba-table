---
task: booking-journey-design-system-rebuild
timestamp_utc: 2026-04-11T19:54:58Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Tool: Chrome DevTools MCP
Surface used: existing local dev server on `http://localhost:3000` because the repo already had an active Next dev instance and a second instance could not acquire `.next/dev/lock`.

### Console & Network

- [x] No Console errors on `/bookings`
- [x] No Console errors on `/restaurants/the-old-crown-girton/book/thank-you`
- [x] No Console errors on `/bookings/recover/error?code=INVALID_ACCESS_TOKEN`
- [x] Network requests match contract on verified public routes
- [ ] `/restaurants/the-old-crown-girton/book` is fully clean
  - Observed warnings:
  - uncontrolled/controlled select warning during wizard render
  - existing Turbopack preload warning for a wizard chunk/font resource

### DOM & Accessibility

- [x] Semantic HTML verified on `/bookings`, `/restaurants/the-old-crown-girton/book/thank-you`, and `/bookings/recover/error`
- [x] ARIA/live-region structure present on the booking wizard step shell
- [x] Focus order logical & visible on verified public surfaces
- [x] Keyboard-only flows succeed for visible CTA links/buttons on verified public surfaces

### Performance (profiled; mobile; 4× CPU; 4G)

- FCP: pending | LCP: pending | CLS: pending | TBT: pending
- Budgets met: [ ] Yes [ ] No (notes)

### Device Emulation

- [ ] Mobile (≈375px)
- [ ] Tablet (≈768px)
- [x] Desktop (≥1280px)

## Test Outcomes

- [x] Typecheck
- [ ] Targeted automated checks
- [x] Browser proof captured

## Verified Routes

- [x] `/bookings`
- [x] `/restaurants/the-old-crown-girton/book`
- [x] `/restaurants/the-old-crown-girton/book/thank-you`
- [x] `/bookings/recover/error?code=INVALID_ACCESS_TOKEN`
- [x] `/restaurants/the-old-crown-girton/thank-you` redirects to `/restaurants/the-old-crown-girton/book/thank-you`
- [x] `/bookings/test-booking-id/manage?foo=bar` preserves the redirect path and lands on the sign-in flow for `/bookings/test-booking-id`
- [x] `/bookings/test-booking-id/thank-you` redirects toward the canonical receipt path, then into sign-in because the receipt surface is auth-gated
- [x] `/bookings/test-booking-id` redirects into sign-in as expected for unauthenticated local verification
- [ ] Authenticated `/bookings/[bookingId]` detail surface itself
  - Blocker: no local auth session or dedicated detail harness during this pass.

## Artifacts

- `artifacts/bookings-page.png`
- `artifacts/restaurant-book-page.png`
- `artifacts/restaurant-book-thank-you.png`
- `artifacts/bookings-recover-error.png`

## Known Issues

- [ ] Booking wizard still emits an uncontrolled/controlled warning in local DevTools.
- [ ] Full authenticated `/bookings/[bookingId]` detail UI was not visually verified in this pass.

## Sign-off

- [ ] Engineering
- [ ] Design/PM
- [ ] QA

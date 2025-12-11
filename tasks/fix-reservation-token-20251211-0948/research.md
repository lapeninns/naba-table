---
task: fix-reservation-token
timestamp_utc: 2025-12-11T09:48:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Preserve confirmation token in guest close path

## Requirements

- Functional:
  - Ensure closing the reservation wizard after successful guest booking returns to a URL that includes the confirmation token so the guest can access the receipt without auth.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain existing routing, avoid exposing secrets; token should remain query param as before.

## Existing Patterns & Reuse

- `useReservationWizard` currently builds `safeReturnPath` from `options.returnPath`, then `initialDetails.bookingId` → `/bookings/{id}/thank-you`, then `initialDetails.restaurantSlug`, else `/`. It ignores any confirmation token and only uses initial details.
- `handleClose` in the same hook navigates to `safeReturnPath`, so guests hitting Close rely on that path.
- `useConfirmationStep.handleManageBooking` constructs `/bookings/{id}?token={reference}` for public access, showing tokens are used as query params for guest management links.

## External Resources

- Issue report from user context: missing token in safeReturnPath causing redirect loop for guests.

## Constraints & Risks

- Risk of breaking authenticated flow; need to preserve session handling and existing thank-you/receipt routing.
- Ensure tokens are not logged or leaked beyond intended query param usage.
- New logic must not drop the fallback paths (restaurant slug, home) when no booking is available.

## Open Questions (owner, due)

- Does a prior helper build public thank-you URLs with token? (owner: assistant, due: 2025-12-11)

## Recommended Direction (with rationale)

- Extend `safeReturnPath` to include the latest confirmation data when present: prefer final booking id + token (e.g., `/bookings/{id}/thank-you?token=...` or `/bookings/{id}?token=...`) captured from confirmation state, not just `initialDetails`.
- If token unavailable, fall back to previous public thank-you route that does not require auth.
- Keep explicit `returnPath` override untouched and retain restaurant/home fallbacks.

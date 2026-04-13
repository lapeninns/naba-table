# Review Pass 1: Cross-Area Flows

## Coverage Verdict

- insufficient: The draft covers broad visual continuity and alias redirects, but it does not pin down the concrete cross-route handoff chains that actually connect this journey: wizard confirmation exit, detail-to-rebook routing, and auth redirect continuity after canonical redirects.

## Missing Assertions

- Add a cross-area assertion for the post-confirmation handoff out of `/restaurants/[slug]/book`: after a successful booking, leaving the in-wizard confirmation state should follow the implemented route chain to `/bookings/[bookingId]/thank-you?...` and then to `/guest/bookings/[bookingId]/receipt?...` when booking identity data exists, with the safe fallback path covered when it does not.
- Add a cross-area assertion for rebook continuity from booking detail back into the venue wizard: the detail surface should send guests to `/restaurants/[slug]/book?source=rebook&reservationId=<id>` (or `/restaurants` when no usable slug exists) so the next booking starts from the right place.
- Add a cross-area assertion for auth continuity after cross-route redirects: when an unauthenticated guest lands on canonical guest-only destinations such as `/guest/bookings/[bookingId]/receipt`, the sign-in redirect should preserve the exact canonical `redirectedFrom` target instead of the legacy alias entry URL.

## Weak Assertions To Tighten

- `VAL-CROSS-001` is too subjective as written (`feel like one booking journey`, `visibly unrelated`). Tighten it to measurable shell continuity such as shared guest theme, shared guest navbar, and consistent primary CTA treatment between `/bookings` and `/restaurants/[slug]/book`.
- `VAL-CROSS-002` bundles three aliases into one assertion, which makes it easy to miss route-specific guarantees. Tighten it by either splitting per alias or explicitly checking identifier preservation, query-string preservation where implemented, and absence of intermediate standalone UI.
- `VAL-CROSS-003` is also overly interpretive (`do not need to relearn the interface`). Tighten it to explicit mobile checks such as summary-card order, action-row/button stacking behavior, and stable placement of primary exits across thank-you, receipt, and detail views.

## Suggested Contract Edits

- Add one new cross-area assertion for the wizard-confirmation exit chain (`/restaurants/[slug]/book` -> thank-you alias/canonical receipt flow).
- Add one new cross-area assertion for detail/receipt -> rebook -> wizard continuity.
- Rewrite `VAL-CROSS-001` and `VAL-CROSS-003` to use concrete UI invariants instead of visual-impression language.
- Either split `VAL-CROSS-002` into per-route checks or explicitly defer to the route-specific assertions in the Confirmation/Detail sections while keeping only the true cross-route expectation here.

## Evidence

- `reserve/features/reservations/wizard/hooks/useReservationWizard.ts`: `buildSafeReturnPath()` and `handleClose()` define the real post-confirmation route handoff chain.
- `src/app/(public)/bookings/[bookingId]/thank-you/page.tsx`: legacy thank-you alias redirects to canonical guest receipt while preserving search params.
- `src/components/features/booking/detail/ReservationDetailClient.tsx`: `handleRebook()` pushes `/restaurants/[slug]/book?source=rebook&reservationId=...`.
- `src/app/guest/bookings/[bookingId]/receipt/page.tsx` and `src/app/(public)/bookings/booking-page.tsx`: auth gating depends on canonical `redirectedFrom` destinations.
- `src/components/layouts/MarketingLayout.tsx` and `src/components/layouts/GuestLayout.tsx`: the hub/wizard routes share guest-theme primitives but use different wrappers, so continuity needs objective checks.
- Existing tests cover the pieces separately but not the full cross-route chains above: `tests/e2e/guest-public-marketing.spec.ts`, `tests/e2e/guest-booking-manage.spec.ts`, `tests/e2e/guest-receipt-pages.spec.ts`, `tests/e2e/guest-portal-redirects.spec.ts`, `tests/guest/public-booking-redirects.test.ts`.

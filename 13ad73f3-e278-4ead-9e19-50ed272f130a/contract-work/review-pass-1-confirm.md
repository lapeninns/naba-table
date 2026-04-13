# Review Pass 1: Confirmation and Thank-You

## Coverage Verdict

- insufficient: The draft covers the happy-path thank-you card and receipt shell, but it misses receipt access-control behavior and the legacy `/thank-you?bookingId=...` alias chain, and several assertions are too loose to reliably catch regressions.

## Missing Assertions

- Add a receipt-access assertion for `/guest/bookings/[bookingId]/receipt`: it should load for a signed-in guest or when a `token` query param is present, and otherwise redirect to `/auth/signin?redirectedFrom=/guest/bookings/[bookingId]/receipt`.
- Add a token-only receipt assertion: when the receipt is opened through a tokenized link without a guest session, it should show the inline `Sign in to manage bookings faster.` prompt linking to `/auth/signin?redirectedFrom=/guest/bookings/[bookingId]`.
- Add the top-level legacy thank-you alias chain: `/thank-you?bookingId=...` should resolve through `/bookings/[bookingId]/thank-you` into `/guest/bookings/[bookingId]/receipt` without dropping query params.

## Weak Assertions To Tighten

- `VAL-CONFIRM-001` should assert the exact existing public card copy, especially `Confirmation email sent with your details and link.`, because the canonical page is a generic lightweight card rather than a booking-summary surface.
- `VAL-CONFIRM-002` should explicitly verify that the redirected destination is the same canonical card with the same headline/body/CTA set, not just any page at the canonical URL.
- `VAL-CONFIRM-003` should say `preserves arbitrary incoming query params`, not just imply token passthrough, and should verify that receipt content renders after the redirect.
- `VAL-CONFIRM-004` should call out the receipt-specific secondary content that distinguishes it from booking detail: the confirmation-email notice, the guest info block, and the mobile-visible `Calendar` / `PDF` / `Share` action row.
- `VAL-CONFIRM-004` should also cover status-specific receipt copy, at least the current cancelled variant (`This reservation has been cancelled.`) versus the normal check-in guidance copy.

## Suggested Contract Edits

- Add `VAL-CONFIRM-005` for receipt access rules and signed-out redirect behavior on `/guest/bookings/[bookingId]/receipt`.
- Add `VAL-CONFIRM-006` for the token-only receipt state that shows the inline sign-in/manage prompt.
- Expand `VAL-CONFIRM-003` so the legacy funnel includes `/thank-you?bookingId=...` as well as `/bookings/[bookingId]/thank-you`.
- Rewrite `VAL-CONFIRM-001` and `VAL-CONFIRM-004` evidence requirements around exact visible copy and mobile action visibility instead of subjective `readable` / `centered` wording.

## Evidence

- `src/app/(public)/(marketing)/restaurants/[slug]/book/thank-you/page.tsx` mounts only `ReservationThankYouCard`.
- `src/components/restaurants/PublicSections.tsx` hard-codes `Reservation confirmed!`, `Confirmation email sent with your details and link.`, and the `View my bookings` / `Explore restaurants` exits.
- `src/app/(public)/(marketing)/restaurants/[slug]/thank-you/page.tsx` redirects the legacy restaurant thank-you route to `/restaurants/[slug]/book/thank-you`.
- `next.config.js` redirects `/thank-you?bookingId=...` to `/bookings/[bookingId]/thank-you`.
- `src/app/(public)/bookings/[bookingId]/thank-you/page.tsx` preserves all incoming search params and redirects to `/guest/bookings/[bookingId]/receipt`.
- `src/app/guest/bookings/[bookingId]/receipt/page.tsx` allows receipt access only with a user session or `token`, otherwise redirecting to sign-in with `redirectedFrom=/guest/bookings/[bookingId]/receipt`.
- `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx` renders the receipt shell, confirmation-email notice, `Calendar` / `PDF` / `Share` actions, cancelled-vs-normal description, and the conditional `Sign in to manage bookings faster.` prompt.
- `tests/e2e/guest-public-marketing.spec.ts`, `tests/e2e/guest-receipt-pages.spec.ts`, `tests/e2e/guest-portal-redirects.spec.ts`, and `tests/guest/public-booking-redirects.test.ts` already exercise parts of these behaviors.

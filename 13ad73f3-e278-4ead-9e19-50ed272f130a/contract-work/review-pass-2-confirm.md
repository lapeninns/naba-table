# Review Pass 2: Confirmation and Thank-You

## Coverage Verdict

- insufficient: pass-1 closed the biggest receipt-access gaps, but the contract still leaves one legacy confirmation entrypoint and one guest-safe receipt failure state outside the validation surface.

## Remaining Gaps

- The top-level legacy alias `/thank-you?bookingId=...` is still uncontracted. `VAL-CONFIRM-004` only covers `/bookings/[bookingId]/thank-you`, so the first redirect hop declared in `next.config.js` could regress without this section noticing.
- The canonical receipt failure state is still uncontracted. `/guest/bookings/[bookingId]/receipt` can render the inline fallback `We couldn't load your receipt. Please try the link again.` with the `View my bookings` exit when auth/token access succeeds but the booking fetch fails; the current contract only covers successful receipt rendering and sign-in redirects.

## Optional Tightening

- Tighten `VAL-CONFIRM-004` so it explicitly requires visible receipt content after the redirect, not just the final URL and destination screenshot.
- Tighten `VAL-CONFIRM-007` to acknowledge the two implemented receipt description variants (`Save this receipt for easier check-in when you arrive.` vs `This reservation has been cancelled.`), which would make status-specific confirmation-copy regressions easier to catch.

## Evidence

- `validation-contract.md` now covers `/bookings/[bookingId]/thank-you`, receipt access control, the token-only sign-in prompt, and the receipt shell in `VAL-CONFIRM-004` through `VAL-CONFIRM-007`, but it still does not mention `/thank-you?bookingId=...`.
- `/Users/amankumarshrestha/LapenInns Project/nabatableLP/next.config.js` defines the legacy `/thank-you` redirect with a required `bookingId` query param and forwards to `/bookings/:bookingId/thank-you`.
- `/Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx` contains both the inline receipt error fallback and the two status-specific receipt description variants.
- `/Users/amankumarshrestha/LapenInns Project/nabatableLP/tests/e2e/guest-receipt-pages.spec.ts` covers the downstream `/bookings/[bookingId]/thank-you` redirect and successful token receipt render, but not the top-level `/thank-you?bookingId=...` hop or the receipt load-failure state.

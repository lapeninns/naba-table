# Review Pass 3: Confirmation and Thank-You

## Coverage Verdict

- sufficient: the pass-2 gaps are closed. `validation-contract.md` now covers the previously missing top-level `/thank-you?bookingId=...` alias chain with `VAL-CONFIRM-008` and the guest-safe receipt load-failure state with `VAL-CONFIRM-009`, while the rest of `VAL-CONFIRM-001` through `VAL-CONFIRM-007` already covers the in-flow confirmation step, canonical restaurant thank-you card, legacy restaurant thank-you redirect, booking thank-you funnel, receipt access rules, token-only sign-in prompt, and the canonical receipt shell.

## Remaining Significant Gaps

- none identified. There are still minor optional tightenings available (for example, pinning the exact normal-vs-cancelled receipt description variants or exhaustively asserting every confirmation action permutation), but they are not significant coverage gaps for the Confirmation/Thank-You scope.

## Evidence

- `validation-contract.md`: `VAL-CONFIRM-001` through `VAL-CONFIRM-009` now cover the full confirmation/receipt surface set called out in the mission: in-flow confirmation essentials, the exact canonical restaurant thank-you experience, the legacy restaurant thank-you redirect, the legacy public booking thank-you redirect into receipt, signed-in vs tokenized receipt access, the token-only sign-in prompt, the canonical receipt shell/actions, the top-level `/thank-you` alias chain, and the guest-safe receipt fallback state.
- `src/components/restaurants/PublicSections.tsx` and `src/app/(public)/(marketing)/restaurants/[slug]/book/thank-you/page.tsx`: these remain the source of truth for the lightweight thank-you card copy and CTA set that `VAL-CONFIRM-002` protects.
- `src/app/(public)/(marketing)/restaurants/[slug]/thank-you/page.tsx`, `next.config.js`, and `src/app/(public)/bookings/[bookingId]/thank-you/page.tsx`: these files implement the confirmation-adjacent redirect chain now explicitly covered by `VAL-CONFIRM-003`, `VAL-CONFIRM-004`, and `VAL-CONFIRM-008`.
- `src/app/guest/bookings/[bookingId]/receipt/page.tsx` and `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`: these define the canonical receipt gate, token/session behavior, inline sign-in prompt, summary/actions shell, and the `We couldn't load your receipt. Please try the link again.` fallback now covered by `VAL-CONFIRM-005` through `VAL-CONFIRM-009`.
- `reserve/features/reservations/wizard/ui/steps/ConfirmationStep.tsx`: this is still the in-flow confirmation source for the booking-status heading, reference, guest/date/time/party summary, and guest-safe follow-up copy/actions covered by `VAL-CONFIRM-001`.

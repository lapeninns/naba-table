# Review Pass 2: Cross-Area Flows

## Coverage Verdict

- sufficient: Pass-1 closed the only material cross-route gaps. `VAL-CROSS-001` through `VAL-CROSS-005` now cover the hub-to-wizard handoff, confirmation exit into the canonical receipt journey, detail-to-rebook continuity, redirect-only alias behavior, and mobile continuity across thank-you/receipt/detail, while auth-only access rules already live in adjacent Confirmation/Detail assertions.

## Remaining Gaps

- None that rise to a significant coverage miss for this frontend-only cross-area section. The previously missing wizard-exit and rebook continuity chains are now explicit, and the remaining auth/redirect edge cases are already covered in `VAL-CONFIRM-005`/`006` and `VAL-DETAIL-002`/`004`/`006` instead of needing duplication here.

## Optional Tightening

- `VAL-CROSS-001` could swap `consistent shell chrome` / `prominent primary-CTA behavior` for concrete UI invariants already visible in the source, such as the shared guest-theme treatment, rounded card container, and single primary browse CTA.
- `VAL-CROSS-005` could name the specific mobile comparison points—summary-card hierarchy, back-affordance placement, and action-row placement/order—so the continuity check is less interpretive.
- If deliberate redundancy is desired, `VAL-CROSS-002` could explicitly mention that a signed-out receipt landing must still preserve the canonical `/guest/bookings/[bookingId]/receipt` return target, though `VAL-CONFIRM-005` already covers that.

## Evidence

- `validation-contract.md` lines 148-168 now map the key cross-surface checkpoints: `/bookings` → `/restaurants/[slug]/book`, confirmation exit → canonical receipt, detail `Book Again` → wizard, redirect-only aliases, and mobile continuity across thank-you/receipt/detail.
- `reserve/features/reservations/wizard/hooks/useReservationWizard.ts`: `buildSafeReturnPath()` and `handleClose()` define the implemented post-confirmation handoff that `VAL-CROSS-002` now targets.
- `src/components/features/booking/detail/ReservationDetailClient.tsx`: `handleRebook()` pushes `/restaurants/[slug]/book?source=rebook&reservationId=...`, matching `VAL-CROSS-003`.
- Alias checkpoint behavior remains explicit in `src/app/(public)/(marketing)/restaurants/[slug]/thank-you/page.tsx`, `src/app/(public)/bookings/[bookingId]/thank-you/page.tsx`, and `src/app/(public)/bookings/[bookingId]/manage/page.tsx`.
- Adjacent route-specific assertions already cover the only remaining auth/redirect risk surface (`VAL-CONFIRM-005`/`006`, `VAL-DETAIL-002`/`004`/`006`), with existing regression coverage in `tests/e2e/guest-public-marketing.spec.ts`, `tests/e2e/guest-receipt-pages.spec.ts`, and `tests/e2e/guest-portal-redirects.spec.ts`.

# Review Pass 1: Restaurant Booking Flow

## Coverage Verdict

- insufficient: the draft covers the happy-path shell, step order, and summary continuity, but it misses concrete validation/error-path assertions that preserve the current guest-facing behavior of `/restaurants/[slug]/book`, especially on mobile.

## Missing Assertions

- The contract does not explicitly verify the customer-mode Details step requirements that are enforced in code today: valid full name, valid email, valid UK phone number, and accepted terms before guests can reach Review.
- The contract does not cover submission failure handling in the flow itself: duplicate bookings, offline confirm attempts, timeout recovery, and “booking in the past” failures are mapped to guest-safe copy and step recovery, but none of that is asserted.
- The contract does not assert the mobile sticky action/progress bar behavior that currently powers one-hand progression: fixed bottom placement, current-step progress, and reachable Back/Review/Confirm actions without clipped or obscured controls.

## Weak Assertions To Tighten

- `VAL-FLOW-002` is too generic. It should name the concrete gating rules for Plan and Details instead of only saying guests cannot advance until “required inputs” are complete.
- `VAL-FLOW-003` is too subjective. “Visually prominent” should be tightened to explicit sticky-bottom navigation/progress behavior on narrow viewports, including no overlap with form fields or safe-area clipping.
- `VAL-FLOW-004` collapses multiple confirmation outcomes into one broad check. It should be tightened to cover the distinct headings/states already implemented (`Booking pending`, `Booking updated`, `Booking confirmed`) and the conditional follow-up actions each state exposes.

## Suggested Contract Edits

- Add a flow assertion for Details-step validation: invalid name/email/phone or unchecked terms keep `Review booking` disabled or surface inline validation, and raw schema text/codes never leak.
- Add a flow assertion for mobile sticky navigation: once the wizard header scrolls away, the bottom action bar shows current step/progress plus step actions, stays reachable on mobile, and does not cover interactive content.
- Split or expand `VAL-FLOW-004` so confirmation validates status-specific headings/copy and action availability, including pending-state behavior where calendar/directions actions are not shown.
- Add a booking-submit error assertion covering at least duplicate-booking and timeout/offline recovery messaging, with customer-safe copy and recovery to the correct step instead of a broken confirmation screen.

## Evidence

- `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx`: the route validates the slug, resolves the restaurant, and renders the venue-scoped `ReservationWizardClient`; missing restaurants go through `notFound()`.
- `reserve/features/reservations/wizard/hooks/useReservationWizard.ts`: defines the four-step meta, sticky-progress visibility, offline banner/plan alerts, timeout recovery, and submission error recovery paths.
- `reserve/features/reservations/wizard/hooks/usePlanStepForm.ts`: only enables `Continue` when the plan form is valid and there are available slots.
- `reserve/features/reservations/wizard/hooks/useDetailsStepForm.ts` and `reserve/features/reservations/wizard/model/schemas.ts`: enforce name/email/UK phone/terms validation before step 3.
- `reserve/features/reservations/wizard/ui/WizardNavigation.tsx`, `ui/WizardContainer.tsx`, and `ui/WizardLayout.tsx`: implement the fixed bottom mobile navigation/progress pattern that the current contract only describes loosely.
- `reserve/features/reservations/wizard/hooks/useConfirmationStep.ts`: implements the concrete confirmation headings (`Booking pending`, `Booking updated`, `Booking confirmed`) and state-dependent action availability.
- `tests/guest/public-restaurants-pages.test.tsx`: covers valid restaurant rendering and `notFound()` for missing slugs.
- `tests/e2e/guest-booking.spec.ts`: covers a happy-path booking and duplicate-booking copy, but not mobile sticky-nav behavior, details validation failures, or pending/updated confirmation variants.
- `tests/a11y/planStepForm.a11y.test.tsx`: gives a plan-step accessibility check, which is helpful but does not cover the missing contract assertions above.
- Verification run: `pnpm exec vitest run tests/guest/public-restaurants-pages.test.tsx tests/a11y/planStepForm.a11y.test.tsx` passed.

# Surface: Restaurant Booking Flow

## User Actions

- Open `/restaurants/[slug]/book` for a valid restaurant and land in a venue-scoped booking wizard.
- Complete **Plan** by choosing a date, selecting an available time, adjusting party size, and optionally adding notes.
- Continue to **Details**, enter guest contact info, optionally opt into saved details / marketing, and accept terms.
- Move to **Review**, verify the booking summary, and use edit affordances to jump back to plan or details without losing progress.
- Confirm the booking and observe the **Confirmation** state (`pending`, `confirmed`, or `updated`), then use follow-up actions or start a new booking.

## Assertions To Cover

- Suggested ID: VAL-FLOW-001
  - Title: Route resolves a restaurant-scoped wizard or hard-fails cleanly
  - Behavior: A valid slug loads the guest booking shell and passes restaurant identity into the wizard; a missing or unknown slug returns `notFound()` instead of a generic fallback booking page.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx`; `tests/guest/public-restaurants-pages.test.tsx`
- Suggested ID: VAL-FLOW-002
  - Title: Step model stays fixed at Plan → Details → Review → Confirmation
  - Behavior: The surface always exposes four steps in that order, with the current step announced accessibly and the bottom navigation kept available for one-hand mobile progression.
  - Tool: agent-browser
  - Evidence: `reserve/features/reservations/wizard/hooks/useReservationWizard.ts`; `reserve/features/reservations/wizard/ui/WizardContainer.tsx`; `reserve/shared/hooks/useStickyProgress.ts`
- Suggested ID: VAL-FLOW-003
  - Title: Plan step blocks progress until a real bookable slot is selected
  - Behavior: `Continue` stays disabled until date, time, and party are valid and an enabled slot exists; closed / no-slot dates clear time and show friendly blocking copy instead of letting the user advance.
  - Tool: agent-browser
  - Evidence: `reserve/features/reservations/wizard/hooks/usePlanStepForm.ts`; `reserve/features/reservations/wizard/ui/steps/plan-step/PlanStepForm.tsx`; `reserve/features/reservations/wizard/model/schemas.ts`
- Suggested ID: VAL-FLOW-004
  - Title: Details step enforces guest-contact requirements and preserves back navigation
  - Behavior: `Back` returns to step 1 with plan choices intact; `Review booking` only enables after valid name, email, UK phone, and accepted terms; invalid submit focuses the first broken field.
  - Tool: agent-browser
  - Evidence: `reserve/features/reservations/wizard/hooks/useDetailsStepForm.ts`; `reserve/features/reservations/wizard/ui/steps/DetailsStep.tsx`; `reserve/features/reservations/wizard/model/schemas.ts`
- Suggested ID: VAL-FLOW-005
  - Title: Review step mirrors the exact user-entered booking and supports safe edits
  - Behavior: Review shows venue, date/time, party, guest details, marketing state, and notes from prior steps, and the inline `Edit` actions jump back to step 1 or 2 without destructive reset.
  - Tool: agent-browser
  - Evidence: `reserve/features/reservations/wizard/ui/steps/ReviewStep.tsx`; `reserve/features/reservations/wizard/hooks/useReviewStep.ts`
- Suggested ID: VAL-FLOW-006
  - Title: Submit flow handles success, pending, duplicate, and timeout states with guest-safe copy
  - Behavior: Confirming immediately advances to step 4 while the request resolves; success shows booking reference and summary facts, duplicate conflicts map to friendly copy, and unrecovered timeouts send the guest back with “check your email” guidance instead of raw API errors.
  - Tool: agent-browser
  - Evidence: `reserve/features/reservations/wizard/hooks/useReservationWizard.ts`; `reserve/features/reservations/wizard/hooks/useConfirmationStep.ts`; `tests/e2e/guest-booking.spec.ts`
- Suggested ID: VAL-FLOW-007
  - Title: Offline and draft resilience do not compromise flow clarity
  - Behavior: Going offline shows the offline banner, disables primary submit/progression actions, keeps editable state local, and restores or clears drafts only under the intended same-restaurant / non-expired rules.
  - Tool: agent-browser
  - Evidence: `reserve/features/reservations/wizard/ui/BookingWizard.tsx`; `reserve/features/reservations/wizard/hooks/useReservationWizard.ts`; `reserve/features/reservations/wizard/api/useCreateReservation.ts`
- Suggested ID: VAL-FLOW-008
  - Title: Signed-in guests get prefilled contact fields without copy drift
  - Behavior: When a guest session/profile exists, name/email/phone are hydrated from profile data, locked where intended, and the surrounding labels/help text stay consistent with the public booking journey.
  - Tool: agent-browser
  - Evidence: `reserve/features/reservations/wizard/ui/BookingWizard.tsx`; `reserve/features/reservations/wizard/ui/steps/DetailsStep.tsx`
- Suggested ID: VAL-FLOW-009
  - Title: Confirmation step stays behaviorally aligned with receipt/detail surfaces
  - Behavior: The confirmation state must show the same booking reference/date/time/party truth that later appears on receipt/detail pages, keep the “manage via email” guidance, and expose calendar/share/directions style follow-up actions without changing booking terminology.
  - Tool: agent-browser
  - Evidence: `reserve/features/reservations/wizard/ui/steps/ConfirmationStep.tsx`; `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`; `src/components/features/booking/detail/ReservationDetailClient.tsx`
- Suggested ID: VAL-FLOW-010
  - Title: Restarting the flow keeps venue context and avoids dead-end navigation
  - Behavior: On confirmation, the visible sticky action is `Start a new booking`; restarting resets the form to step 1 but keeps the same restaurant context instead of ejecting the guest to a generic browse page.
  - Tool: agent-browser
  - Evidence: `reserve/features/reservations/wizard/hooks/useReservationWizard.ts`; `reserve/features/reservations/wizard/hooks/useConfirmationStep.ts`; `reserve/features/reservations/wizard/model/reducer.ts`

## Edge Cases / Boundaries

- Missing or unknown restaurant slug should 404 before any wizard UI renders.
- Closed dates, no-slot dates, and unknown-availability dates should all block continuation with distinct guest-facing copy.
- Party size is bounded by online limits; the UI explicitly redirects 12+ parties toward calling the venue.
- Customer mode requires full name, email, UK phone number, and accepted terms; ops-mode exceptions are out of scope for this surface.
- Authenticated guests may see locked profile-backed contact fields, so validation should cover both anonymous and signed-in paths.
- Offline mode allows editing but not confirming.
- Submission can end in `pending` / `pending_allocation`, not only `confirmed`.
- Timeout recovery retries lookup by contact before surfacing fallback guidance, so tests should distinguish recovered vs unrecovered timeout behavior.
- The default fallback return path is `/guest/thank-you`, which currently redirects to the dashboard; receipt access still depends on auth or token.

## Implementation Clues

- Entry route: `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx`
- Client wrapper: `src/components/features/booking/wizard/ReservationWizardClient.tsx`
- Wizard orchestration and state transitions: `reserve/features/reservations/wizard/ui/BookingWizard.tsx` and `reserve/features/reservations/wizard/hooks/useReservationWizard.ts`
- Step-specific action contracts live in `usePlanStepForm.ts`, `useDetailsStepForm.ts`, `useReviewStep.ts`, and `useConfirmationStep.ts`
- Public booking flow behavior is already exercised in `tests/e2e/guest-booking.spec.ts`
- Design-consistency reference surfaces are `src/components/features/booking/detail/ReservationDetailClient.tsx`, `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`, and shared guest-booking primitives in `src/components/features/booking/ui/BookingComponents.tsx`

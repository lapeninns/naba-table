# AGENTS.md

## Mission Boundaries (NEVER VIOLATE)

- Frontend-only mission for the guest booking journey
- Reuse the existing local Next.js app server on port `3000`
- Do not start isolated Playwright web servers for this mission
- Do not change backend/API/data-model behavior
- Do not change redirect semantics for legacy alias routes
- Do not change route topology or canonical destinations
- Do not rewrite guest-facing copy unless a feature explicitly requires a tiny UX wording fix

Workers: if the requested outcome requires breaking any boundary above, return to the orchestrator.

## Design and Implementation Guidance

- Use the existing `/bookings` experience as the visual source of truth
- Prioritize mobile-first one-hand booking and responsive behavior on all route surfaces
- Prefer extending shared booking primitives over introducing one-off wrappers:
  - `src/components/features/booking/ui/BookingComponents.tsx`
  - `src/components/features/booking/detail/ReservationDetailClient.tsx`
  - `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`
  - `src/components/features/booking/wizard/ReservationWizardClient.tsx`
  - `reserve/features/reservations/wizard/*`
- Keep thank-you aliases and manage aliases thin; the destination UX is what should be improved
- When docs disagree with code, trust live route code and existing automated tests

## Route and Behavior Invariants

- `/restaurants/[slug]/thank-you` must keep redirecting to `/restaurants/[slug]/book/thank-you`
- `/bookings/[bookingId]/manage` must keep redirecting to `/bookings/[bookingId]`
- `/bookings/[bookingId]/thank-you` must keep redirecting to `/guest/bookings/[bookingId]/receipt` while preserving query params
- `/bookings/[bookingId]?access_token=...` must keep handing off through `/bookings/recover`
- `?token=` remains deprecated on `/bookings/[bookingId]` detail but still valid on receipt handoff paths; do not normalize this away
- Signed-in and signed-out redirect targets must remain unchanged unless a feature explicitly requires them

## Testing & Validation Guidance

- Run the commands defined in repo `.factory/services.yaml`
- Validate in the browser against the shared server at `http://127.0.0.1:3000`
- Check mobile viewport first, then desktop/tablet as needed
- For changed canonical routes, also verify at least one adjacent handoff or alias route
- Treat legacy aliases as redirect checkpoints only
- If a signed-in assertion cannot be completed because no stable guest auth/bootstrap path is available, document the blocker explicitly instead of inventing new credentials or changing scope

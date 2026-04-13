# Surface: Cross-Area Flows

## User Actions

- Start on `/bookings`, use the public action card to browse restaurants, choose a venue, and enter `/restaurants/[slug]/book`.
- Complete a restaurant booking and confirm the thank-you step keeps the guest moving into either `/guest/bookings` or back to `/restaurants` without copy or CTA drift.
- Open booking details from direct public/recovery entrypoints (`/bookings/[bookingId]`, `/bookings/recover?access_token=...`) and compare that experience with guest entrypoints (`/guest/bookings`, `/guest/bookings/[bookingId]`, `/guest/bookings/[bookingId]/receipt`).
- Enter through legacy alias routes (`/reserve/r/[slug]`, `/book/[slug]`, `/restaurants/[slug]/thank-you`, `/bookings/[bookingId]/manage`, `/bookings/[bookingId]/thank-you`, `/reserve/[bookingId]`, `/guest/bookings/[bookingId]`) and validate that each resolves into the same destination flow instead of becoming its own surface.
- Check mobile-first route-to-route continuity for back affordances, primary actions, and receipt/detail hierarchy after each cross-surface handoff.

## Assertions To Cover

- Suggested ID: VAL-CROSS-001
  - Title: `/bookings` launches the same restaurant-booking journey users reach from discovery.
  - Behavior: The `/bookings` landing page must keep the existing "Browse restaurants" CTA, route users into `/restaurants`, and from there into `/restaurants/[slug]/book`, where the reservation wizard renders inside the guest booking shell without alternate copy or duplicate entry logic.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/page.tsx`; `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx`; `tests/e2e/guest-public-pages.spec.ts`; `tests/guest/public-restaurants-pages.test.tsx`
- Suggested ID: VAL-CROSS-002
  - Title: Restaurant thank-you aliases collapse into one confirmation surface.
  - Behavior: `/restaurants/[slug]/thank-you` must redirect to `/restaurants/[slug]/book/thank-you`, and the destination must preserve the existing "Reservation confirmed!" copy plus the "View my bookings" and "Explore restaurants" exits so the thank-you state stays continuous with the rest of the guest journey.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/(marketing)/restaurants/[slug]/thank-you/page.tsx`; `src/app/(public)/(marketing)/restaurants/[slug]/book/thank-you/page.tsx`; `src/components/restaurants/PublicSections.tsx`; `tests/e2e/guest-public-marketing.spec.ts`
- Suggested ID: VAL-CROSS-003
  - Title: Legacy booking thank-you links flow into the canonical receipt with query continuity.
  - Behavior: `/bookings/[bookingId]/thank-you` must redirect to `/guest/bookings/[bookingId]/receipt`, preserve incoming query params such as `token` or attribution fields, and land on the same receipt summary/actions seen by direct receipt entry.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/[bookingId]/thank-you/page.tsx`; `src/app/guest/bookings/[bookingId]/receipt/page.tsx`; `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`; `tests/e2e/guest-receipt-pages.spec.ts`; `tests/guest/public-booking-redirects.test.ts`
- Suggested ID: VAL-CROSS-004
  - Title: Public detail, guest detail aliases, and legacy manage entrypoints converge on one booking-detail experience.
  - Behavior: `/bookings/[bookingId]`, redirected guest detail entry (`/guest/bookings/[bookingId]`), and `/bookings/[bookingId]/manage` must all resolve to the same booking-detail UI, preserve query strings like `view=manage`, and keep auth/recovery redirects coherent instead of creating divergent layouts.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/[bookingId]/page.tsx`; `src/app/(public)/bookings/booking-page.tsx`; `src/app/guest/bookings/[bookingId]/page.tsx`; `src/app/(public)/bookings/[bookingId]/manage/page.tsx`; `next.config.js`; `tests/e2e/guest-booking-manage.spec.ts`; `tests/e2e/guest-portal-redirects.spec.ts`
- Suggested ID: VAL-CROSS-005
  - Title: Recovery-link handoff and failure states stay inside the booking journey.
  - Behavior: Access-token entry from `/bookings/[bookingId]` must route through `/bookings/recover` into the requested booking detail, while missing/invalid/expired tokens must land on `/bookings/recover/error` with the current code-specific copy and only the existing sign-in/home exits.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/[bookingId]/page.tsx`; `src/app/(public)/bookings/recover/route.ts`; `src/app/(public)/bookings/recover/error/page.tsx`; `tests/e2e/guest-public-pages.spec.ts`
- Suggested ID: VAL-CROSS-006
  - Title: Detail and receipt routes keep one shared mobile-first interaction pattern.
  - Behavior: Booking detail and receipt surfaces must continue to share the same shell primitives (`BookingDetailShell`, `BookingSummaryCard`, `ActionButtonRow`, `SummaryActions`) so back affordances, summary hierarchy, and action placement remain consistent when users move between management and receipt routes on narrow viewports.
  - Tool: agent-browser
  - Evidence: `src/components/features/booking/ui/BookingComponents.tsx`; `src/components/features/booking/detail/ReservationDetailClient.tsx`; `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`

## Edge Cases / Boundaries

- Treat legacy aliases as redirect QA checkpoints only; do not expect unique UI on `/restaurants/[slug]/thank-you`, `/bookings/[bookingId]/manage`, `/bookings/[bookingId]/thank-you`, `/reserve/r/[slug]`, `/book/[slug]`, `/reserve/[bookingId]`, or `/guest/bookings/[bookingId]`.
- Preserve current copy, status labels, and CTA text exactly; these notes are for validation contracts, not rewrites.
- Validate query preservation on redirect-only paths (`token`, `source`, `view`, `access_token`, `next`) because several cross-surface flows depend on them.
- Cover unauthenticated, authenticated, token-based, and recovery-cookie entry separately; booking detail and receipt allow different access modes even when they share visual primitives.
- Mobile-first QA should focus on one-hand reach for primary actions and back navigation after each redirect/handoff, because the mission source of truth is the existing bookings experience.

## Implementation Clues

- `/bookings` entry is implemented in `src/app/(public)/bookings/page.tsx`; restaurant booking starts in `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx` via `ReservationWizardClient`.
- Restaurant confirmation continuity lives in `src/app/(public)/(marketing)/restaurants/[slug]/thank-you/page.tsx`, `src/app/(public)/(marketing)/restaurants/[slug]/book/thank-you/page.tsx`, and `src/components/restaurants/PublicSections.tsx`.
- Booking detail/recovery alias handling lives in `src/app/(public)/bookings/[bookingId]/page.tsx`, `src/app/(public)/bookings/booking-page.tsx`, `src/app/(public)/bookings/[bookingId]/manage/page.tsx`, `src/app/(public)/bookings/[bookingId]/thank-you/page.tsx`, `src/app/(public)/bookings/recover/route.ts`, and `src/app/(public)/bookings/recover/error/page.tsx`.
- Guest receipt/detail coherence is easiest to inspect in `src/app/guest/bookings/[bookingId]/receipt/page.tsx`, `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`, `src/app/guest/bookings/[bookingId]/page.tsx`, `src/components/features/booking/detail/ReservationDetailClient.tsx`, and `src/components/features/booking/ui/BookingComponents.tsx`.
- Redirect expectations are already encoded in `next.config.js`, `tests/e2e/guest-public-pages.spec.ts`, `tests/e2e/guest-public-marketing.spec.ts`, `tests/e2e/guest-portal-redirects.spec.ts`, `tests/e2e/guest-receipt-pages.spec.ts`, `tests/e2e/guest-booking-manage.spec.ts`, and `tests/guest/public-booking-redirects.test.ts`.

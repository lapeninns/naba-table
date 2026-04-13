# Surface: Confirmation and Thank-You

## User Actions

- Complete a booking in `/restaurants/[slug]/book` and review the in-flow confirmation step before leaving the wizard.
- Open `/restaurants/[slug]/book/thank-you` directly or arrive there through `/restaurants/[slug]/thank-you`.
- Open `/bookings/[bookingId]/thank-you` from an email/link and confirm it resolves to the guest receipt.
- View `/guest/bookings/[bookingId]/receipt` with either a signed-in guest session or a tokenized link.
- Attempt the same receipt without auth or token and verify the recovery redirect path.
- Use the confirmation/receipt CTAs that matter for the guest journey: `View my bookings`, `Explore restaurants`, `Calendar`, `PDF`, `Share`, and the conditional sign-in/manage link.

## Assertions To Cover

- Suggested ID: VAL-CONFIRM-001
  - Title: In-flow booking confirmation keeps the booking essentials visible before exit
  - Behavior: After `Confirm booking` in `/restaurants/[slug]/book`, step 4 stays inside the wizard and shows a confirmation-state heading (`Booking confirmed`, `Booking updated`, or `Booking pending`), email-status copy, booking reference, guest name, date/time, party size, and confirmation actions (calendar/directions) whenever the booking is no longer pending.
  - Tool: agent-browser
  - Evidence: `reserve/features/reservations/wizard/ui/steps/ConfirmationStep.tsx`, `reserve/features/reservations/wizard/hooks/useConfirmationStep.ts`, `tests/e2e/guest-booking.spec.ts`
- Suggested ID: VAL-CONFIRM-002
  - Title: Restaurant thank-you alias resolves to the canonical lightweight confirmation card
  - Behavior: `/restaurants/[slug]/thank-you` must redirect to `/restaurants/[slug]/book/thank-you`, and the canonical page must render the generic public card with the exact existing copy (`Reservation confirmed!`, `Confirmation email sent with your details and link.`) plus `View my bookings` and `Explore restaurants` CTAs.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/(marketing)/restaurants/[slug]/thank-you/page.tsx`, `src/app/(public)/(marketing)/restaurants/[slug]/book/thank-you/page.tsx`, `src/components/restaurants/PublicSections.tsx`, `tests/e2e/guest-public-marketing.spec.ts`
- Suggested ID: VAL-CONFIRM-003
  - Title: Legacy public booking thank-you links funnel into the guest receipt without dropping query state
  - Behavior: `/bookings/[bookingId]/thank-you` must preserve all incoming query params and redirect to `/guest/bookings/[bookingId]/receipt`; the top-level `/thank-you?bookingId=...` redirect must feed into the same alias chain.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/[bookingId]/thank-you/page.tsx`, `next.config.js`, `tests/guest/public-booking-redirects.test.ts`, `tests/e2e/guest-receipt-pages.spec.ts`
- Suggested ID: VAL-CONFIRM-004
  - Title: Guest receipt is the canonical receipt-style confirmation destination
  - Behavior: `/guest/bookings/[bookingId]/receipt` must render a booking-summary shell with venue heading, status badge, reference, date/time/party summary cards, guest info, confirmation-email notice, and both summary/stacked action buttons for `Calendar`, `PDF`, and `Share`.
  - Tool: agent-browser
  - Evidence: `src/app/guest/bookings/[bookingId]/receipt/page.tsx`, `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`, `tests/e2e/guest-receipt-pages.spec.ts`
- Suggested ID: VAL-CONFIRM-005
  - Title: Receipt access rules distinguish token recovery from signed-in guest management
  - Behavior: The receipt must load when the guest is signed in or when a `token` query param is present; without either, it must redirect to `/auth/signin?redirectedFrom=/guest/bookings/[bookingId]/receipt`. When loaded through token access without a session, the receipt must also show the inline `Sign in to manage bookings faster.` prompt linking to `/auth/signin?redirectedFrom=/guest/bookings/[bookingId]`.
  - Tool: agent-browser
  - Evidence: `src/app/guest/bookings/[bookingId]/receipt/page.tsx`, `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`, `tests/e2e/guest-portal-redirects.spec.ts`
- Suggested ID: VAL-CONFIRM-006
  - Title: Receipt and manage/detail destinations stay separate in the guest journey
  - Behavior: The thank-you alias should terminate at `/guest/bookings/[bookingId]/receipt`, not at `/bookings/[bookingId]`; `/bookings/[bookingId]/manage` remains a helper redirect into the public detail/manage page, and `/bookings/[bookingId]` keeps its own auth/recovery rules as a management destination rather than the receipt surface.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/[bookingId]/manage/page.tsx`, `src/app/(public)/bookings/[bookingId]/page.tsx`, `src/app/guest-facing-pages.ts`

## Edge Cases / Boundaries

- Route code and route tests are the current source of truth here; older docs such as `docs/current-routes.md` and `docs/adr/2025-12-03-guest-route-naming.md` disagree with the live implementation on which thank-you path is canonical.
- `/guest/thank-you` is deprecated and only redirects to `/guest/dashboard`; it should not be treated as a booking confirmation destination.
- `/restaurants/[slug]/book/thank-you` is intentionally generic and does not hydrate booking-specific data; preserve its current copy and CTA set instead of expecting receipt details there.
- `/bookings/[bookingId]/thank-you` must preserve arbitrary query params, not only `token`, because tests already assert generic passthrough behavior.
- `/guest/bookings/[bookingId]/receipt` doubles as the tokenized receipt and the signed-in receipt; missing data should fall back to the existing inline error state with `View my bookings`.
- `/bookings/[bookingId]` is a separate manage/detail experience: `access_token` is routed through recovery, while legacy `token` on that page is explicitly deprecated.

## Implementation Clues

- The in-flow confirmation contract lives in `reserve/features/reservations/wizard/ui/steps/ConfirmationStep.tsx` and `reserve/features/reservations/wizard/hooks/useConfirmationStep.ts`; use this as the baseline for heading/copy/reference/date-party consistency.
- The lightweight public thank-you card lives in `src/components/restaurants/PublicSections.tsx` and is mounted by `src/app/(public)/(marketing)/restaurants/[slug]/book/thank-you/page.tsx`; the sibling slug route only redirects there.
- The legacy public booking thank-you alias is implemented at `src/app/(public)/bookings/[bookingId]/thank-you/page.tsx`, while the global query-param alias is declared in `next.config.js`.
- The canonical receipt surface is `src/app/guest/bookings/[bookingId]/receipt/page.tsx` plus `ReceiptClient.tsx`; this is the only thank-you-adjacent page that carries the full receipt summary/action stack.
- The downstream manage/detail surface is still `src/app/(public)/bookings/[bookingId]/page.tsx` (with `/manage/page.tsx` as a helper redirect), so validation should keep receipt expectations separate from manage/edit expectations.
- Existing regression anchors already cover the key route contracts: `tests/e2e/guest-booking.spec.ts`, `tests/e2e/guest-public-marketing.spec.ts`, `tests/e2e/guest-receipt-pages.spec.ts`, `tests/guest/public-booking-redirects.test.ts`, and `tests/e2e/guest-portal-redirects.spec.ts`.

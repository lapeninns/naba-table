---
task: guest-thank-you-redirect
timestamp_utc: 2025-11-28T08:04:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Guest Thank-You Redirect

## Objective

Send guests to a dedicated `/guest/thank-you` page after completing the booking flow (pending or confirmed) and provide clear next steps (manage bookings, go home).

## Success Criteria

- Booking wizard finishes and navigates to `/guest/thank-you` by default.
- Thank-you page renders under guest layout with CTAs for managing bookings and returning home.
- Accessibility maintained (semantic heading, button labels, focusable links).

## Architecture & Components

- `src/components/features/booking/wizard/ReservationWizardClient.tsx`: adjust default `returnPath` to `/guest/thank-you`.
- `src/app/guest/thank-you/page.tsx`: new guest thank-you page using `GuestLayout` (via existing layout wrapper).

## Data Flow & API Contracts

- No backend changes. Client-side navigation from wizard uses `returnPath` to redirect once the confirmation step closes/auto-redirects.

## UI/UX States

- Static thank-you view with success message valid for both pending and confirmed cases; CTA buttons for bookings/home.

## Edge Cases

- Users without authentication hitting the page should still see the thank-you message and links (read-only view).
- Pending bookings should still land here because returnPath does not depend on status.

## Testing Strategy

- Manual: run booking flow (mock/test env) to confirmation and ensure navigation to `/guest/thank-you`.
- Visual: verify CTAs and focus order on thank-you page.
- Accessibility: keyboard navigation across CTAs and heading semantics.

## Rollout

- No flags; small scoped UI change. Standard deploy.

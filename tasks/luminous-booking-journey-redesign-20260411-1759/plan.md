---
task: luminous-booking-journey-redesign
timestamp_utc: 2026-04-11T17:59:00Z
owner: github:@amanshresthaa
reviewers: [github:@guest-experience]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Luminous Booking Journey Redesign

## Objective

We will rebuild the guest-facing booking journey around the Luminous Precision design system so that guests move through discovery, booking, confirmation, and management in a consistent editorial interface that feels premium, clear, and tactile.

## Success Criteria

- [ ] The design system is saved at repo root and referenced as the source of truth for guest-facing design.
- [ ] Public booking entry and post-booking management surfaces follow the Luminous Precision rules for color, type, spacing, depth, and component treatment.
- [ ] Shared booking components no longer rely on divider-heavy, default-shadow, or border-first styling patterns on the redesigned path.
- [ ] Primary CTAs, glass surfaces, and tonal section separation are implemented consistently across the redesigned booking journey.
- [ ] The booking journey remains accessible and functionally unchanged.

## Architecture & Components

- Root design system document:
  - `GUEST_FACING_DESIGN_SYSTEM.md`: canonical visual blueprint for guest-facing pages.
- Guest-facing policy reference:
  - `src/guest/AGENTS.md`: amended to point visual decisions to the root design system.
- Shared guest-booking styles:
  - `styles/guest-design-system.css` and `src/app/globals.css`: updated token bridge for Luminous Precision surfaces.
- Booking shell components:
  - `reserve/features/reservations/wizard/ui/WizardLayout.tsx`
  - `reserve/features/reservations/wizard/ui/WizardNavigation.tsx`
  - `reserve/features/reservations/wizard/ui/steps/*`
  - `src/components/features/booking/ui/BookingComponents.tsx`
- Route composition surfaces:
  - `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx`
  - `src/components/features/booking/list/BookingListClient.tsx`
  - `src/components/features/booking/detail/ReservationDetailClient.tsx`
  - `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`
  - `src/components/restaurants/PublicSections.tsx` (thank-you and public booking-adjacent sections as needed)

## Data Flow & API Contracts

- No API contract changes expected.
- Existing query/data paths remain:
  - public booking create/read via current reservation APIs
  - guest bookings list via `useGuestBookings`
  - reservation detail/receipt via `useReservation`
- Errors and loading states remain in existing contracts; visual containers are replaced.

## UI/UX States

- Booking wizard:
  - Loading
  - Step 1 plan
  - Step 2 details
  - Step 3 review
  - Step 4 confirmation
  - Offline/banner states
  - Validation/error states
- Post-booking surfaces:
  - Loading
  - Empty
  - Error
  - Success
  - Past/cancelled/pending state variants

## Edge Cases

- Authenticated guests with locked profile fields in the details step.
- Pending bookings that can’t yet be self-managed.
- Receipt access via auth or token-only flow.
- Mobile layouts with sticky navigation and safe-area padding.
- Reduced-motion users with sticky/floating UI.

## Testing Strategy

- Unit / integration:
  - Reuse current test surface where available; add focused proof only if visual restructuring changes behavior.
- Manual UI proof:
  - Required via Chrome DevTools MCP on redesigned public/guest routes.
- Accessibility:
  - Validate focus order, keyboard navigation, visible focus, semantic structure, and alert/live-region behavior on the real journey.

## Rollout

- Feature flag: none
- Exposure: direct replacement on canonical guest-facing surfaces
- Monitoring: local browser verification and existing runtime error surfaces
- Kill-switch: revert the styling/component changes on the same canonical path

## DB Change Plan (if applicable)

- No database changes planned.

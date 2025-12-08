---
task: enhance-booking-steps
timestamp_utc: 2025-12-08T00:06:24Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Enhance Booking Steps 3 & 4

## Objective

Enhance the UI/UX of the "Review" and "Confirmation" steps in the booking wizard to match the "Premium Guest Experience" and provide better post-booking utility.

## Success Criteria

- [ ] Review Step clearly displays all booking details in a scannable format.
- [ ] Users can easily edit any section from the Review Step.
- [ ] Confirmation Step provides visual feedback of success.
- [ ] Confirmation Step includes "Add to Calendar" functionality.
- [ ] UI matches the "Midnight Majesty" design system (colors, spacing, typography).
- [ ] Mobile responsive.

## Architecture & Components

- **ReviewStep.tsx**:
  - Update layout to use `GuestCard` with "receipt" styling.
  - Improve data visualization (icons + text).
  - Ensure "Edit" buttons link back to respective steps.

- **ConfirmationStep.tsx**:
  - Add `AddToCalendar` component.
  - Improve "What's Next" section.
  - Ensure strict checks for `checkoutSession` or `booking` existence to prevent showing empty states.

- **New Components**:
  - `BookingSummaryCard`: (If reusable) A detailed view of the booking.
  - `CalendarLinks`: Component to generate Google/Outlook/ICS links.

## Data Flow & API Contracts

No API changes expected. Data is already available in the client context (`useBookingFlow`).

## UI/UX States

- **Review**: Static view of drafted data.
- **ConfirmationSuccess**: Booking confirmed.
- **ConfirmationPending**: (Should be handled by wizard, but good to check).

## Testing Strategy

- **Manual QA**: Run through the booking flow on localhost.
- **Unit Tests**: Check if `ReviewStep` renders all fields.

## Rollout

- Immediate deployment as part of the guest experience enhancement.

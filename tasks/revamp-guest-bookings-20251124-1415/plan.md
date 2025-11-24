---
task: revamp-guest-bookings
timestamp_utc: 2025-11-24T14:15:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Revamp Guest Bookings Page

## Objective

Revamp the Guest Bookings page (`/guest/bookings`) to improve visual appeal, consistency, and user experience.

## Success Criteria

- [ ] Modern, card-based layout with better visual hierarchy.
- [ ] Improved "Empty State" designs for both Upcoming and Past tabs.
- [ ] Actionable cards: Add "View Details", "Modify", and "Cancel" options where appropriate.
- [ ] Mobile-first responsive design.

## Architecture & Components

- **Component**: `src/components/features/booking/list/BookingListClient.tsx`
- **UI Components**: `Card`, `Button`, `Badge`, `DropdownMenu`, `Tabs`.

## Execution Steps

1.  **Enhance `BookingCard`**:
    - Add a visual header/banner to the card (using a gradient or pattern).
    - Organize details (Date, Time, Party Size) into a clean grid.
    - Add a `DropdownMenu` for actions (View, Modify, Cancel).
    - Use semantic colors for Status Badges.
2.  **Improve Page Layout**:
    - Add a proper page header with title and "New Booking" button.
    - Style the Tabs to be more prominent.
3.  **Refine Empty States**:
    - Use better iconography and clear calls to action.

## Verification

- **Manual**:
  - Visit `/guest/bookings`.
  - Check Upcoming and Past tabs.
  - Verify card layout on desktop and mobile.
  - Check empty states (if no bookings).

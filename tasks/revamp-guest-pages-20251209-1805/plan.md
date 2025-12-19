---
task: revamp-guest-pages
timestamp_utc: 2025-12-09-1805
owner: antigravity
---

# Implementation Plan: Revamp Guest Pages (Bookings & Profile)

## Objective

Extend the "Midnight Majesty" (DesignSystem.md) aesthetic to all guest-facing pages, specifically:

- `/guest/bookings` (List)
- `/guest/bookings/[id]` (Detail)
- `/guest/profile` (Profile)

## Strategy

1.  **Unify Design System**: Merge `DashboardDesignSystem` components into `src/components/guest/ui/GuestPrimitives.tsx` to create a single source of truth for guest UI components.
2.  **Revamp Bookings List**:
    - Use `GuestSection` and `GuestCard` with new styles.
    - Implement a clean list view using `UpcomingBookingCard` (rename to `BookingListCard` and make generic).
    - Add filters if present, using "pills" or simple tabs.
3.  **Revamp Booking Detail**:
    - Use the "Ticket" style from the dashboard for the header.
    - Clean up the details section (Date, Time, Guests) using `MetricTile` or `DetailItem`.
    - Enhance "Manage" actions (Cancel, Modify).
4.  **Revamp Profile**:
    - Clean up form layouts (reduce width, better spacing).
    - Use `GuestSection` for grouping.

## Step-by-Step

1.  **Refactor Primitives**: Update `src/components/guest/ui/GuestPrimitives.tsx` with `MetricTile`, `SearchBar` (genericize if needed), `ActionCard`.
2.  **Refactor Booking List**:
    - File: `src/components/features/guest/bookings/GuestBookingListClient.tsx` (or similar).
    - Replace existing list with new components.
3.  **Refactor Booking Detail**:
    - File: `src/components/features/guest/bookings/GuestBookingDetailClient.tsx` (or similar).
    - Apply "Ticket" header and clean details.
4.  **Refactor Profile**:
    - File: `src/components/features/guest/profile/GuestProfileClient.tsx`.
    - Apply new layout.

## Verification

- Check all 3 pages for visual consistency with Dashboard.

---
task: revamp-guest-dashboard-20251125-2303
timestamp_utc: 2025-11-25T23:03:04Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Verification: Revamp Guest Dashboard

## Manual QA Steps

1.  **Hero Section**:
    - Verify the greeting changes based on time of day.
    - Verify the background image loads and looks good with the overlay.
    - Check "Find a Table" and "View Menu" buttons link correctly.

2.  **Active Reservation**:
    - **Scenario 1: No Booking**: Verify "No active reservations" empty state is shown with a CTA.
    - **Scenario 2: Upcoming Booking**: Verify the "Ticket" card appears with correct restaurant name, date, time, and party size.
    - **Scenario 3: Live Booking**: Verify the status badge says "Live" (if implemented in logic) or "Upcoming".
    - Check "Modify", "Directions", "Share", and "Running Late" buttons.

3.  **Favorites & Discovery**:
    - Verify horizontal scroll on Favorites.
    - Verify grid layout on Discovery.
    - Check empty states for both.

4.  **Perks Card**:
    - Verify the progress bar reflects the `totalBookings` count.

## Automated Tests

- [ ] Run `npm run lint` to ensure no regressions. (Passed)
- [ ] Run `npm run build` to ensure no build errors.

## Artifacts

- Updated `src/components/features/guest/dashboard/GuestDashboardClient.tsx`.

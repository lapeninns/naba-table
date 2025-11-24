---
task: revamp-guest-bookings
timestamp_utc: 2025-11-24T14:20:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Verification: Revamp Guest Bookings

## Manual Verification Steps

1.  **Navigate to `/guest/bookings`**:
    - Ensure the page loads without errors.
    - Verify the header "My Bookings" and "New Booking" button are present.

2.  **Check Upcoming Tab**:
    - If you have bookings:
      - Verify cards display Restaurant Name, Date, Time, Guests, Location.
      - Verify the top gradient strip on cards.
      - Click the "..." menu on a card. Verify "View details", "Modify", and "Cancel" options appear (if applicable).
      - Verify "Manage reservation" link at the bottom of the card works.
    - If no bookings:
      - Verify the empty state card with icon and "Browse Restaurants" button.

3.  **Check Past Tab**:
    - Switch to "Past" tab.
    - Verify past bookings are listed.
    - Verify actions are limited (e.g., no "Modify" or "Cancel" if status is completed/cancelled).

4.  **Responsive Design**:
    - Resize browser to mobile width.
    - Verify cards stack correctly.
    - Verify tabs are easy to tap.

## Visual Checks

- Status badges should have appropriate colors (Green for Confirmed, Red for Cancelled).
- Typography should be consistent with the rest of the app (Inter font, clear hierarchy).

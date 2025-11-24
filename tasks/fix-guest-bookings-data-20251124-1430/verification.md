---
task: fix-guest-bookings-data
timestamp_utc: 2025-11-24T14:35:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Verification: Fix Guest Bookings Data

## Manual Verification Steps

1.  **Navigate to `/guest/bookings`**:
    - Ensure the page loads without errors.
    - Check the booking cards.

2.  **Verify Date and Time**:
    - The "Date" field on the card should show a valid date (e.g., "Fri, Nov 24").
    - The "Time" field on the card should show a valid time (e.g., "7:00 PM").
    - Ensure it does NOT say "Invalid Date" or show empty values.

3.  **Verify Sorting**:
    - "Upcoming" bookings should be sorted by date (nearest first).
    - "Past" bookings should be sorted by date (most recent first).

4.  **Verify Filters (Optional)**:
    - If possible, check if date filtering works (though UI might not expose it directly yet).

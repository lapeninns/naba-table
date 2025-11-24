---
task: fix-guest-bookings-data
timestamp_utc: 2025-11-24T14:30:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix Guest Bookings Data Fetching

## Objective

Fix the data fetching logic for the Guest Bookings page (`/guest/bookings`). Currently, the API tries to select `start_at` and `end_at` columns which do not exist in the `bookings` table, resulting in missing Date and Time information in the UI.

## Success Criteria

- [ ] `/api/bookings` endpoint correctly fetches `booking_date`, `start_time`, and `end_time`.
- [ ] `startIso` and `endIso` are correctly constructed in the API response.
- [ ] Guest Bookings page displays the correct Date and Time for each booking.
- [ ] No mock data is used.

## Architecture & Components

- **API Route**: `src/app/api/bookings/route.ts`
- **Logic**: Update `handleMyBookings` to query the correct columns and map them to `BookingDTO`.

## Execution Steps

1.  **Modify `src/app/api/bookings/route.ts`**:
    - Update the Supabase query in `handleMyBookings` to select `booking_date`, `start_time`, `end_time` instead of `start_at`, `end_at`.
    - Update the `BookingRow` type definition to match the selected columns.
    - Update the mapping logic to construct `startIso` and `endIso` by combining date and time.
    - Ensure `startIso` is formatted in a way that the frontend components (`formatReservationDate`, `formatReservationTime`) can handle (likely ISO 8601).

## Verification

- **Manual**:
  - Navigate to `/guest/bookings`.
  - Verify that upcoming and past bookings show the correct Date and Time.
  - Verify that the data persists (refresh page).

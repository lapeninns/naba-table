---
task: fix-guest-bookings-data
timestamp_utc: 2025-11-24T14:42:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Todo: Fix Guest Bookings Data

- [x] Create task plan (`plan.md`).
- [x] Update `src/app/api/bookings/route.ts` to use `booking_date`, `start_time`, `end_time`.
- [x] Update filtering logic in `src/app/api/bookings/route.ts`.
- [x] Fix date/time parsing in `BookingListClient.tsx` to extract date and time portions correctly.
- [x] Create verification instructions (`verification.md`).

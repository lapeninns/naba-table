# Implementation Checklist

## Setup

- [x] Verify app is running (Process ID 61846 confirmed).

## Execution

- [x] Open browser to localhost:3000.
- [x] Navigate to a restaurant page (http://localhost:3000/restaurants/white-horse-pub-waterbeach).
- [ ] Select Date & Time. (Blocked: Page failed to load)
- [ ] Select Party Size. (Blocked)
- [ ] Select Table/Area. (Blocked)
- [ ] Enter Guest Details (amanshresthaaaaa@gmail.com). (Blocked)
- [ ] Confirm Booking. (Blocked)
- [ ] Verify Success. (Blocked)

## Notes

- Assumptions: App is running on port 3000.
- Deviations:
  - Server starts but fails to serve pages due to `Invalid API key` error from Supabase.
  - Booking flow script also fails with 500 error from API.
  - Fixed `scripts/run-booking-flow.ts` to correctly load environment variables, but the underlying API issue remains.

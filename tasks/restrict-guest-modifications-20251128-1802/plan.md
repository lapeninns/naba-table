# Plan

- Review booking self-serve update and cancel flows in `src/app/api/bookings/[id]/route.ts` to understand existing guest restrictions and time validation.
- Introduce guest-side locking rules that block updates/cancellations when the booking is checked in, when the service start time has passed, or within 15 minutes of the scheduled start.
- Add focused tests in `src/app/api/bookings/[id]/route.test.ts` to cover the new guest lock scenarios for both PUT and DELETE requests.
- Validate behavior via automated tests and summarize results in the verification log.

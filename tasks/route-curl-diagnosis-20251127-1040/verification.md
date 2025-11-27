---
task: route-curl-diagnosis
timestamp_utc: 2025-11-27T10:40:20Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Curl Findings (local dev http://localhost:3000)

- `/` → 200 OK (marketing landing), sets `csrf_token` (artifact: `artifacts/root.txt`).
- `/thank-you` → 200 OK (static page).
- `/guest` → 307 → `/guest/dashboard` (redirect; likely guest home routing) (artifact: `artifacts/guest.txt`).
- `/guest/bookings` → 307 → `/auth/signin?redirectedFrom=/guest/bookings` (auth required) (artifact: `artifacts/guest-bookings.txt`).
- `/app` → 307 → `/app/login?redirectedFrom=%2Fapp` with logs showing `Auth session missing` (auth gate) (artifact: `artifacts/app.txt`).
- `/api/availability` → 400 with zod validation errors for missing `date` and `partySize` params (artifact: `artifacts/api-availability.txt`).
- `/api/bookings` → 400 invalid payload (missing email/phone) (artifact: `artifacts/api-bookings.txt`).
- `/api/ops/bookings` → 500 JSON `{ "error": "Unable to verify session" }` with server log `[ops/bookings][GET] failed to resolve auth Auth session missing!` (artifact: `artifacts/api-ops-bookings.txt`).
- `/api/ops/restaurants` → 500 JSON `{ "error": "Unable to verify session" }` with server log `[ops/restaurants][GET] failed to resolve auth Auth session missing!` (artifact: `artifacts/api-ops-restaurants.txt`).

## Interpretation

- Marketing pages are healthy (200).
- Guest/app pages redirect to auth when unauthenticated; this is expected, not a broken route.
- Public APIs respond with 400 because required query/body parameters are missing—expected behavior.
- Ops APIs return 500 instead of 401/403 when no auth session is present; logs show auth resolution failure, so likely should be 401 but surfaces as 500. This matches user-reported “routes not working.”

## Notes

- Did not reproduce the “Cookies can only be modified in a Server Action or Route Handler” error during these curls; may occur under different route or when code attempts to set cookies in server components. No curls attempted to mutate cookies beyond csrf.

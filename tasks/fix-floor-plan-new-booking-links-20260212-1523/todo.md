---
task: fix-floor-plan-new-booking-links
timestamp_utc: 2026-02-12T15:23:48Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Checklist

- [x] Identify correct ops routes for bookings and new bookings (`/app/*`).
- [x] Update floor plan navigation to use `/app/new-bookings` and `/app/bookings`.
- [x] `npm run typecheck`
- [x] DevTools QA: click New booking / Browse bookings from floor plan harness
- [x] Complete `verification.md`

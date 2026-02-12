---
task: fix-floor-plan-new-booking-links
timestamp_utc: 2026-02-12T15:23:48Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Verification

## Automated

- [x] `npm run typecheck` (pass)

## Manual QA (Chrome DevTools MCP)

Route: `http://localhost:3000/dev/ops-floor-plan`

- [x] Click "New booking": navigates to `/app/new-bookings` (observed redirect to `/app/auth/signin` in unauthenticated DevTools context).
- [x] Click "Browse bookings": navigates to `/app/bookings` (observed redirect to `/app/auth/signin` in unauthenticated DevTools context).

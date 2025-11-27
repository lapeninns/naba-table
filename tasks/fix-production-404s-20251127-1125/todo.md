---
task: fix-production-404s
timestamp_utc: 2025-11-27T11:25:00Z
owner: github:@amanshresthaa
reviewers: []
risk: high
flags: []
related_tickets: []
---

# Todo: Fix Production 404 Errors

- [x] Identify missing `middleware.ts`.
- [x] Locate `src/proxy.ts` containing middleware logic.
- [x] Rename `src/proxy.ts` to `src/middleware.ts`.
- [x] Verify build (`npm run build`).
- [x] Fix ESLint warnings in `src/app/api/ops/bookings/[id]/route.ts` and `src/app/api/ops/bookings/route.ts`.

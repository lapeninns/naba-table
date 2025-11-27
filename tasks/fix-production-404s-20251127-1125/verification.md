---
task: fix-production-404s
timestamp_utc: 2025-11-27T11:25:00Z
owner: github:@amanshresthaa
reviewers: []
risk: high
flags: []
related_tickets: []
---

# Verification: Fix Production 404 Errors

## Manual QA

- **Build Verification**: `npm run build` passed successfully.
- **Middleware Detection**: Build output confirmed `ƒ Proxy (Middleware)` is active.
- **Route Logic Check**:
  - `app.nabatable.com/customers` -> Rewrite to `/app/customers` -> Maps to `src/app/app/(app)/customers/page.tsx` (Verified existence).
  - `app.nabatable.com/seating/floor-plan` -> Rewrite to `/app/seating/floor-plan` -> Maps to `src/app/app/(app)/seating/floor-plan/page.tsx` (Verified existence).
  - `app.nabatable.com/api/dashboard/summary` -> Rewrite to `/api/ops/dashboard/summary` -> Maps to `src/app/api/ops/dashboard/summary/route.ts` (Verified existence).

## Artifacts

- Build output confirms middleware presence.

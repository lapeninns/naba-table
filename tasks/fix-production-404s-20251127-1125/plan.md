---
task: fix-production-404s
timestamp_utc: 2025-11-27T11:25:00Z
owner: github:@amanshresthaa
reviewers: []
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Fix Production 404 Errors

## Objective

Restore functionality to `app.nabatable.com` routes by activating the missing middleware.

## Success Criteria

- [ ] `src/middleware.ts` exists and contains the logic from `src/proxy.ts`.
- [ ] Build passes.
- [ ] Routes like `/customers` and `/api/dashboard/summary` are correctly routed.

## Architecture & Components

- **Middleware**: `src/middleware.ts` handles subdomain rewrites.

## Rollout

- Immediate fix.
- Deploy to production.

## Verification

- `npm run build` to ensure middleware is compiled.
- Manual verification of routes (simulated or by user).

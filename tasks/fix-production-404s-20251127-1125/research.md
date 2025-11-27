---
task: fix-production-404s
timestamp_utc: 2025-11-27T11:25:00Z
owner: github:@amanshresthaa
reviewers: []
risk: high
flags: []
related_tickets: []
---

# Research: Fix Production 404 Errors

## Requirements

- **Functional**: Fix 404 errors for critical routes (`/customers`, `/seating/floor-plan`, `/settings/*`, `/api/dashboard/summary`) on `app.nabatable.com`.
- **Non-functional**: Ensure zero downtime or immediate recovery.

## Existing Patterns & Reuse

- The codebase uses Next.js Middleware for subdomain routing (`app.` vs `www.`).
- `src/proxy.ts` contains the logic but was not active as `middleware.ts`.

## Constraints & Risks

- Production is currently broken for these routes.
- Renaming the file activates middleware which affects ALL requests.

## Root Cause Analysis

- `middleware.ts` was missing from the root and `src` directories.
- `src/proxy.ts` existed with the correct middleware logic but was not being used by Next.js.
- Without middleware, requests to `app.nabatable.com` were not being rewritten to `/app/...` or `/api/ops/...`, causing 404s.

## Recommended Direction

- Rename `src/proxy.ts` to `src/middleware.ts`.
- Verify build.

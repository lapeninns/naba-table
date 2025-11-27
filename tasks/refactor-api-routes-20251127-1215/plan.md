---
task: refactor-api-routes
timestamp_utc: 2025-11-27T12:15:00Z
owner: github:@amanshresthaa
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Refactor API Routes

## Objective

Rename `src/app/api/ops` to `src/app/api/app` and update all references to ensure a consistent "app" namespace for restaurant-facing features.

## Success Criteria

- [ ] `src/app/api/ops` does not exist.
- [ ] `src/app/api/app` exists.
- [ ] `src/middleware.ts` redirects/rewrites correctly to `/api/app`.
- [ ] All code references to `/api/ops` are updated to `/api/app`.
- [ ] Build passes.

## Architecture & Components

- **API Structure**: `src/app/api/app` will house all restaurant APIs.
- **Middleware**: Updated to route to `app` instead of `ops`.

## Rollout

- Immediate refactor.

## Verification

- `npm run build`
- Manual check of routes.

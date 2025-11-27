---
task: refactor-api-routes
timestamp_utc: 2025-11-27T12:15:00Z
owner: github:@amanshresthaa
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Refactor API Routes

## Requirements

- Consolidate all restaurant-facing API routes under `/api/app` (currently `/api/ops`).
- Ensure consistent routing structure: `domain.com/app/...` for UI and `domain.com/api/app/...` for API.
- Remove reliance on "ops" naming which is inconsistent with the "/app" UI path.

## Existing Patterns

- `src/app/api/ops` contains all restaurant APIs.
- `src/middleware.ts` rewrites `/api/xyz` to `/api/ops/xyz` for app subdomains.

## Recommended Direction

1.  Rename `src/app/api/ops` to `src/app/api/app`.
2.  Update `src/middleware.ts` to rewrite to `/api/app`.
3.  Update all client-side code and hooks to use `/api/app` (or rely on the middleware rewrite if we keep it, but better to be explicit or consistent).
    - Actually, if we rename the folder, the middleware _must_ update.
    - If the client uses `/api/bookings`, the middleware rewrites it. We just need to change the _target_ of the rewrite.
    - However, some code might be using `/api/ops` directly (as seen in grep results). These MUST be updated.

## Risks

- Breaking existing API calls if references are missed.
- Middleware misconfiguration.

## Plan

1.  Rename directory.
2.  Update middleware.
3.  Find and replace `/api/ops` -> `/api/app` in `src`.
4.  Verify build.

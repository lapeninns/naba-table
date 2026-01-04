# Research: Fix Auth Redirect 404

## Requirements

- Functional:
  - Unauthenticated users accessing the app subdomain (e.g. `/dashboard`) should be redirected to the sign-in page (`/auth/signin`).
  - The `redirectedFrom` parameter must be preserved.
  - Fix the 404 error occurring at `/auth?redirectedFrom=...`.

- Non-functional:
  - Maintain existing routing logic for other paths.

## Existing Patterns & Reuse

- `src/proxy.ts` handles middleware-like routing and redirects.
- `src/proxy.test.ts` contains tests for routing logic.

## Constraints & Risks

- Changing `src/proxy.ts` affects all requests.
- Ensure no infinite redirect loops.

## Recommended Direction

- Change the unauthenticated redirect target in `src/proxy.ts` from `/auth` to `/auth/signin`.

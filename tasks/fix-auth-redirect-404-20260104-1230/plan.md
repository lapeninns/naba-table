# Implementation Plan: Fix Auth Redirect 404

## Objective

Fix the 404 error when unauthenticated users are redirected to `/auth`. Redirect them to `/auth/signin` instead.

## Success Criteria

- [x] Accessing `/dashboard` (unauthenticated) redirects to `/auth/signin?redirectedFrom=/dashboard`.
- [x] Accessing `localhost:3000/app` redirects to `app.localhost:3000/auth/signin...`.
- [x] `src/proxy.test.ts` passes with a new test case.

## Architecture & Components

- `src/proxy.ts`: Update redirect logic.
- `src/proxy.test.ts`: Add test case.

## Testing Strategy

- Unit test in `src/proxy.test.ts`.
- Manual verification via user.

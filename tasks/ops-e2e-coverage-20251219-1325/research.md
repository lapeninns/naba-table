# Research

## Summary

- Restaurant-facing routes live under `src/app/app/(app)` and are served on `app.<root-domain>` with middleware rewrites/redirects.
- Available Ops pages in this repo: `/dashboard`, `/bookings`, `/new-bookings`, `/customers`, `/management/team` (redirects), `/settings/restaurant/*`, `/settings/tables`.
- Middleware handles app-host redirects (`/` -> `/dashboard`, `/settings` -> `/settings/restaurant/profile`, `/management` -> `/management/team`) and `/app/*` canonicalization.
- Ops sign-in page is `app.nabatable.com/auth/signin` (rewrites to `/app/auth/signin`).

## Gaps to cover

- Route coverage for all existing ops pages + canonical redirects.

## Constraints

- Use ops credentials from env secrets (no creds in repo).
- Avoid routes not present in repo (analytics, seating, walk-in) to prevent false failures.

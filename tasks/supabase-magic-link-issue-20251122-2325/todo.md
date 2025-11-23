---
task: supabase-magic-link-issue
timestamp_utc: 2025-11-22T23:25:14Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm Supabase auth config (allowed redirects) for dev/prod.
- [x] Map current login flow (`/app/login` → magic link → `/api/auth/callback`).

## Core

- [x] Add/stub `/api/v1/events` route to stop 404 noise (if acceptable).
- [x] Investigate/explain why magic link fails (callback error, allowlist, etc.) and fix.

## UI/UX

- [ ] Keep SignInForm states intact; ensure success message appears after send.

## Tests

- [ ] Local magic link flow on port 3000 (request link, follow callback).
- [ ] `pnpm run build` or `pnpm run lint` as time allows.

## Notes

- Assumptions: Analytics backend not wired; stub acceptable short-term.
- Deviations: None yet.

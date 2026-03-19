---
task: fix-build-signin-env
timestamp_utc: 2026-03-19T00:07:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Build and auth signin env failures

## Objective

We will stabilize local build and auth sign-in error handling so that production builds no longer emit postbuild env parser failures and local sign-in returns a valid HTTP error when Supabase is unreachable.

## Success Criteria

- [ ] Build completes without `next-sitemap` env loading errors.
- [ ] Password sign-in never passes an invalid status code to `NextResponse`.
- [ ] Existing App Router sitemap/robots behavior remains intact.

## Architecture & Components

- `src/app/api/auth/signin/route.ts`: normalize upstream auth error statuses before responding.
- `package.json`: remove fragile `postbuild` sitemap generation hook from the production build path.

## Data Flow & API Contracts

Endpoint: `POST /api/auth/signin`
Request: existing auth sign-in payload
Response: unchanged shape, but fallback status becomes a valid server error when upstream status is missing/invalid.
Errors: `{ message }`

## UI/UX States

- No direct UI change.
- Sign-in callers continue to receive a stable JSON error payload.

## Edge Cases

- DNS/network errors from Supabase client with no HTTP status.
- Unexpected numeric statuses outside the HTTP range.

## Testing Strategy

- Build verification.
- Targeted route logic inspection.

## Rollout

- No feature flag.
- Ship directly with normal CI verification.

## DB Change Plan (if applicable)

- No database changes.

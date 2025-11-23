---
task: supabase-magic-link-issue
timestamp_utc: 2025-11-22T23:25:14Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Fix Supabase magic link flow on /app/login

## Objective

Ensure magic link sign-in on `/app/login` sends links and successfully signs users in without 404 noise.

## Success Criteria

- [ ] Magic link email sends from `/app/login`.
- [ ] Clicking link exchanges session and redirects to the requested path (e.g., `/app`) without errors.
- [ ] `/api/v1/events` no longer 404s during login.

## Architecture & Components

- `src/app/app/(app)/login/page.tsx` + `components/auth/SignInForm` (frontend flow).
- `src/app/api/auth/callback/route.ts` (session exchange + redirect).
- Potential stub for `src/app/api/v1/events/route.ts` to handle analytics posts.

## Data Flow & API Contracts

- Supabase `signInWithOtp` → email link → `/api/auth/callback?code=...&redirectedFrom=...` → `exchangeCodeForSession` → redirect to `redirectedFrom`.
- Analytics emitter posts `{ events }` JSON to `/api/v1/events`; should accept and noop (204) if not wired to backend.

## UI/UX States

- Maintain existing SignInForm states (info/success/error, cooldown).
- On success, continue redirect to target.

## Edge Cases

- Non-absolute `redirectedFrom` values rejected.
- Missing/invalid code in callback logs warning but redirects to fallback.
- Magic link from non-allowed domain/port fails; need allowlist alignment.

## Testing Strategy

- Local dev on port 3000: request magic link, click email link (or craft URL) to verify session set + redirect.
- Verify `/api/v1/events` returns 204.
- Smoke `pnpm run build` or lint if time permits.

## Rollout

- No feature flag; small surface change.
- If analytics stub added, document as temporary noop until real backend exists.

## DB Change Plan

- Not applicable.

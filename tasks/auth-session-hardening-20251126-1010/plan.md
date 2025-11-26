---
task: auth-session-hardening
timestamp_utc: 2025-11-26T10:10:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Auth session hardening

## Objective

Reduce auth/session abuse risk by adding server-side rate limiting, stronger password validation, CSRF protections, and hardened cookie flags while keeping current Supabase-based UX intact.

## Success Criteria

- [ ] Password sign-in rejects inputs below new strength rules client- and server-side.
- [ ] Auth POSTs are rejected without a valid CSRF token and return 403.
- [ ] Rate limit enforcement returns 429 with headers when exceeded for both password and magic-link attempts.
- [ ] Supabase auth cookies are issued with `httpOnly`, `secure`, and `sameSite` defaults enforced by our adapter.
- [ ] Sign-in flows (magic-link and password) still succeed and redirect as before.

## Architecture & Components

- `src/app/api/auth/signin/route.ts`: new server endpoint to handle password + magic-link, apply zod validation, rate limiting (`consumeRateLimit`), CSRF check, and call Supabase server client (preserving cookies).
- `server/security/csrf.ts`: server helper to issue CSRF cookie (double-submit token) and validate incoming requests using constants from `lib/security/csrf.ts`.
- `components/auth/SignInForm.tsx`: update schema and submission to call the new API, surface rate-limit/CSRF errors, and keep UX parity.
- `src/app/auth/signin/page.tsx` + `src/app/app/(app)/login/page.tsx`: ensure CSRF token cookie is set on page render.
- `server/supabase.ts`: enforce secure cookie flags in the cookie adapter used by server/middleware clients.

## Data Flow & API Contracts

- Endpoint: `POST /api/auth/signin`
  - Request: `{ mode: 'password' | 'magic_link', email: string, password?: string, redirectedFrom?: string }` plus `x-csrf-token` header matching `sr-csrf-token` cookie.
  - Responses:
    - 200 for success `{ status: 'ok', redirectedFrom?: string, message?: string }`.
    - 202 for magic-link sent `{ status: 'magic_link_sent' }`.
    - 400 for validation errors; 403 for CSRF missing/invalid; 429 for rate limited (with limit headers); 401/500 for auth errors.

## UI/UX States

- Loading states unchanged; new error copy for 403/429/validation.
- Password field enforces min length/complexity with inline message.

## Edge Cases

- Missing or mismatched CSRF token → 403.
- Rate limit exceeded per IP/email → 429 with retry-after info.
- Redirect target sanitized to same-site path before pass-through.

## Testing Strategy

- Unit tests for `POST /api/auth/signin` covering happy path, rate-limit reject, and CSRF failure.
- Unit test for password schema (min length/complexity) if not covered in route tests.
- Manual QA: sign-in via password and magic link in browser with DevTools console/network (attach notes in verification.md).

## Rollout

- No flag; ship hardened endpoint and form together. Monitor auth error logs for spikes; fallback is to roll back route + form changes.

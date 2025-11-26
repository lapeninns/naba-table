---
task: auth-session-hardening
timestamp_utc: 2025-11-26T10:10:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Auth session hardening

## Requirements

- Add server-enforced rate limiting for auth entry points (password + magic-link) to block brute-force/bot abuse.
- Enforce a strong password policy prior to Supabase sign-in (min length & complexity).
- Harden Supabase session cookies (secure/httpOnly/sameSite) and add CSRF protection for cookie-backed POSTs.
- Preserve existing UX (magic link + password modes, redirects) while adding the above controls.

## Existing Patterns & Reuse

- Rate limiting helper already exists at `server/security/rate-limit.ts` (supports Upstash + in-memory dev fallback).
- Supabase server/browser clients live in `server/supabase.ts` and `lib/supabase/browser.ts`; auth callback handled in `src/app/api/auth/callback/route.ts`.
- Sign-in UI and validation live in `components/auth/SignInForm.tsx`; pages use it at `src/app/auth/signin/page.tsx` and `src/app/app/(app)/login/page.tsx`.
- Client-side CSRF constants/helper exist in `lib/security/csrf.ts`, but no server issuance/verification yet.

## External Resources

- Supabase Next.js auth pattern (route handler `exchangeCodeForSession`) already in repo; no new external dependency required for planned scope.

## Constraints & Risks

- Supabase hosted auth endpoints are currently called directly from the client; adding server-side controls will require a proxy route without breaking session cookie issuance.
- Upstash credentials may be absent in local/dev; rate limiter must keep dev fallback (already handled in helper).
- MFA and breach-password checks are out of scope for this iteration; note as follow-ups.

## Open Questions (owner, due)

- None for current scope; MFA/step-up approach to be defined in a later task.

## Recommended Direction (with rationale)

- Introduce a server-side sign-in API that proxies password/magic-link flows, applies rate limits, validates CSRF, and leverages existing Supabase server client so cookies are set with hardened flags.
- Issue and validate a double-submit CSRF token (cookie + header) on auth pages using existing client helper.
- Strengthen password schema in the sign-in form (and server-side validation) to enforce minimum length + basic complexity before Supabase calls.
- Explicitly set secure cookie attributes in the Supabase cookie adapter to reduce CSRF/session leakage risk.

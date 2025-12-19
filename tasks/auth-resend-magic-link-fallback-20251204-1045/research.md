---
task: auth-resend-magic-link-fallback
timestamp_utc: 2025-12-04T10:45:22Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix Resend fallback magic link redirect

## Requirements

- Functional: Ensure Resend fallback magic links establish a Supabase session successfully and redirect users to their intended destination.
- Non-functional: Maintain existing primary magic link flow and callbacks; avoid widening redirect surface (hostname validation stays intact).

## Existing Patterns & Reuse

- `buildCallbackUrl` in `src/app/api/auth/signin/route.ts` builds the redirect for standard Supabase OTP (server callback).
- `ImplicitAuthHandler` (client) processes implicit flow tokens from URL hash on `/auth/signin` layout.
- `sendMagicLinkViaResend` uses `auth.admin.generateLink` which returns implicit-flow links containing `#access_token`/`#refresh_token`.

## External Resources

- None (behavior inferred from existing Supabase helpers and components in repo).

## Constraints & Risks

- Changing the redirect for fallback must not affect the primary signInWithOtp path.
- Redirect must land on a client route that mounts `ImplicitAuthHandler` so hash tokens can be consumed; otherwise users remain signed out.

## Open Questions (owner, due)

- None currently.

## Recommended Direction (with rationale)

- Keep primary `signInWithOtp` redirect pointing to `/api/auth/callback`.
- For Resend fallback, generate a redirect to the client `/auth/signin` page (same hostname logic) with `redirectedFrom` + `rememberMe` preserved; rely on `ImplicitAuthHandler` to exchange hash tokens and navigate.

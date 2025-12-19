---
task: auth-resend-magic-link-fallback
timestamp_utc: 2025-12-04T10:45:22Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Resend fallback magic link redirect

## Objective

Make the Resend fallback magic link redirect to a client route that can read implicit auth tokens and create a session, fixing the broken recovery path when Supabase email delivery fails.

## Success Criteria

- [ ] Resend fallback links land on `/auth/signin` (or equivalent client page) with redirect params preserved.
- [ ] `ImplicitAuthHandler` can read the hash tokens and set a session; user ends up on intended redirect target.
- [ ] Primary Supabase `signInWithOtp` flow remains unchanged.

## Architecture & Components

- File: `src/app/api/auth/signin/route.ts`
- Add a client-redirect builder (reuse hostname validation) for implicit flow fallback.
- Use new redirect only for `sendMagicLinkViaResend`; keep standard `emailRedirectTo` for `signInWithOtp`.

## Data Flow & API Contracts

- No external API changes; only modifies the redirect URL passed to Supabase admin-generated link.

## UI/UX States

- Auth page already mounts `ImplicitAuthHandler`; no UI surface changes.

## Edge Cases

- Hostname validation must still normalize localhost and `www.` domains.
- `redirectedFrom` should still be sanitized/absolute before inclusion.

## Testing Strategy

- Update unit tests in `src/app/api/auth/signin/route.test.ts` to assert fallback redirect points to `/auth/signin`.
- Run `pnpm run test -- src/app/api/auth/signin/route.test.ts`.

## Rollout

- No feature flags; deploy with standard release process.

---
task: auth-email-fallback
timestamp_utc: 2025-11-28T07:49:53Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Stop fallback from sending multiple auth emails

## Objective

Ensure that a single, correct email is sent for passwordless sign-in in production. Prevent Supabase fallback from emitting both “Confirm signup” and “Magic link” emails.

## Success Criteria

- New/unknown emails no longer trigger Supabase account creation or confirm-signup emails from fallback.
- Existing users receive only the magic-link email when requesting sign-in.
- Tests cover the new `signInWithOtp` options and error mapping.

## Architecture & Components

- API route: `src/app/api/auth/signin/route.ts`
  - Update `signInWithOtp` call to disable implicit signup (`shouldCreateUser: false`).
  - Surface a clear error for non-existent users (reuse existing error mapping).
- Tests: `src/app/api/auth/signin/route.test.ts` and form tests if needed.

## Data Flow & Contracts

- Request unchanged: `{ mode: 'magic_link' | 'password', email, password?, redirectedFrom? }`.
- For `magic_link` mode, call `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo, shouldCreateUser: false } })`.
- On Supabase 400 “User not found”, respond 400 with user-friendly message; keep current rate limiting headers.

## UI/UX States

- No UI changes expected; SignIn form already shows magic-link success/error states. Verify error copy still makes sense for “no account found”.

## Edge Cases

- Unknown email requests magic-link: should return 400, no email sent.
- Existing unconfirmed user (if any) should still receive magic-link (depends on Supabase confirmation setting; acceptable).
- Rate limit still enforced.

## Testing Strategy

- Unit: update `signin` route tests to assert `shouldCreateUser: false` passed to Supabase and proper response mapping for missing user error.
- Form tests: ensure UI handles 400 properly (optional if API test suffices).
- Manual (post-change): hit `/api/auth/signin` with new + existing email and verify only one email is sent (staging mailbox); capture in verification.md.

## Rollout

- No feature flag; ship directly. Validate in staging before production.
- Monitoring: check Supabase auth email logs or inbox to confirm single email.

## Open Questions / Assumptions

- Assume we do _not_ want implicit signup via magic link; production signups remain invite-only.
- Supabase email confirmations remain enabled; goal is simply to avoid the confirm-signup email path for magic-link logins.

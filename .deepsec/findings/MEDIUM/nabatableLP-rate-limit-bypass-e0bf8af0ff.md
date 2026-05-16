# [MEDIUM] Password confirmation bypasses application login throttling

**File:** [`server/auth/password-confirmation.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/auth/password-confirmation.ts#L35-L73) (lines 35, 59, 60, 73)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

verifyUserPasswordConfirmation uses Supabase signInWithPassword as a step-up password verifier, but the helper has no application-level rate limit or failure counter. The traced ops Google Business Profile callers invoke it directly after admin authorization, so a compromised admin session can use those endpoints as an oracle for password guesses outside the normal signin route's PASSWORD_RATE_LIMIT. Supabase may still apply provider-side throttles, but the app's intended stricter login throttling is bypassed here.

## Recommendation

Add rate limiting to this helper or require callers to pass userId/client IP and call consumeRateLimit before each confirmation attempt. Key limits on user/email plus IP, count failed confirmations, and return generic lockout errors.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)

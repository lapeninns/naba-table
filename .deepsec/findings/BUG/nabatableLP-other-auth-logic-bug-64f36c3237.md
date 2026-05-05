# [BUG] Password sign-in rejects valid legacy passwords client-side

**File:** [`components/auth/OpsSignInForm.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/components/auth/OpsSignInForm.tsx#L30-L184) (lines 30, 31, 34, 36, 181, 182, 183, 184)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-auth-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The ops sign-in form reuses the password creation policy for login. The zod resolver applies passwordPolicySchema to the password field, and the submit handler trims the password and calls validatePasswordStrength before sending credentials to /api/auth/signin. Existing accounts with valid Supabase passwords that do not meet the current creation policy, or passwords with intentional leading/trailing spaces, cannot submit the form even though the server sign-in endpoint only requires a password value.

## Recommendation

For sign-in, validate only that the password field is non-empty and pass the raw password through unchanged. Keep passwordPolicySchema for signup, reset, or password-change flows.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-04)

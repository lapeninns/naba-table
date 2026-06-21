# [BUG] Password creation policy is reused for sign-in

**File:** [`lib/security/passwordPolicy.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/lib/security/passwordPolicy.ts#L5-L19) (lines 5, 6, 17, 19)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-auth-logic-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

This helper trims passwords and enforces creation-time complexity. The ops sign-in form imports passwordPolicySchema and validatePasswordStrength before calling /api/auth/signin, so existing valid Supabase passwords that do not meet the current creation policy, or that intentionally contain leading or trailing spaces, can be blocked or altered before authentication.

## Recommendation

Keep this policy for signup, reset, and password-change flows only. Use a separate sign-in validator that checks only for a non-empty raw password and passes the untrimmed value to Supabase.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-26)

# [MEDIUM] Turnstile action and hostname checks fail open when fields are missing

**File:** [`server/security/turnstile.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/security/turnstile.ts#L107-L130) (lines 107, 108, 109, 116, 117, 120, 124, 125, 129, 130)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-captcha-validation-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

verifyTurnstileToken only rejects an action mismatch when the verification response contains a truthy action, and only rejects a hostname mismatch when the response contains a truthy hostname. If expectedAction or expectedHostname is supplied, a successful Siteverify response with an absent or empty action/hostname is accepted. Turnstile responses can omit action for tokens generated without an action; because the site key is public client-side, this weakens the intended guest_signin_magic_link action binding used by the signin route and would also fail open for missing hostname data.

## Recommendation

When expectedAction is provided, require action === expectedAction exactly and reject null or empty action. When expectedHostname is provided, require a non-empty hostname that exactly matches the normalized expected hostname. Add regression tests for missing and empty action/hostname fields.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-19)

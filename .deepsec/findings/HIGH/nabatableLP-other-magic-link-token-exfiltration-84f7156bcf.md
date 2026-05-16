# [HIGH] Magic-link callback origin is trusted without validation

**File:** [`server/auth/magic-link-email.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/auth/magic-link-email.ts#L19-L222) (lines 19, 21, 81, 205, 222)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** medium • **Slug:** `other-magic-link-token-exfiltration`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

sendAuthMagicLink accepts emailRedirectTo from callers, passes it to Supabase as redirectTo, then appends token_hash to that same URL for the emailed link. The signin/signup callers derive emailRedirectTo from request host/origin; if a spoofed or loosely allowed host is accepted, a victim can receive a valid magic link pointing at an attacker-controlled origin, exposing the token_hash for account takeover. The HTML escaping mitigates XSS but not a malicious callback origin.

## Recommendation

Resolve magic-link callbacks inside this helper against a fixed configured app origin or exact allow-list, reject arbitrary or suffix-matched hosts, and only pass validated callback URLs to Supabase and email rendering.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-23)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

**Verdict:** fixed

`sendAuthMagicLink` now validates `emailRedirectTo` centrally through `normalizeTrustedMagicLinkRedirect` before any Supabase `generateLink` call. The validation requires `/api/auth/callback`, exact configured auth hosts, and HTTPS outside approved local development hosts. Invalid origins throw `MagicLinkDeliveryError` with `reason: "invalid_redirect"` before a hashed token can be generated or appended to an email link. The focused regression command `pnpm exec vitest run tests/server/auth/signin-route-magic-link-policy.test.ts tests/server/auth/callback-route-security.test.ts tests/server/auth/magic-link-email.test.ts` passed with 17 tests, including helper-level rejection for `https://evil-nabatable.com/api/auth/callback` and `http://www.nabatable.com/api/auth/callback`.

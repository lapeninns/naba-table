# [HIGH] Spoofable host parsing can poison auth magic-link URLs

**File:** [`lib/auth/redirects.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/lib/auth/redirects.ts#L89-L118) (lines 89, 92, 96, 98, 104, 107, 109, 110, 111, 112, 113, 116, 118)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `auth-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

parseHostname trusts x-forwarded-host, x-original-host, Origin, and Referer before Host or req.nextUrl, returning the first parsed value without validating it against the configured root/app hosts. The auth sign-in route uses this value to build emailRedirectTo for magic-link emails, and its callback builder accepts any hostname ending with the literal string nabatable.com, so an attacker-controlled registrable domain such as evil-nabatable.com passes. An attacker can request a magic link for a known victim email using their own CSRF cookie plus a spoofed Origin or forwarded host, cause the victim to receive a legitimate email pointing at the attacker domain, capture token_hash when clicked, and redeem it for a session. Spoofing app.nabatable.com can also misclassify the surface as app_ops and skip guest Turnstile checks.

## Recommendation

Do not use Origin or Referer for trusted host decisions, and only honor forwarded host headers after trusted proxy normalization. Prefer a fixed canonical callback origin or validate Host/req.nextUrl against an exact allowlist of rootDomain, www.rootDomain, and app.rootDomain. Also harden the auth callback builder to require exact hosts or dot-boundary subdomains, rejecting domains that merely end with the brand string.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-29)

**Verdict:** fixed

`parseHostname` no longer accepts `x-forwarded-host`, `x-original-host`, `Origin`, or `Referer` for auth host decisions; it resolves from `req.nextUrl`, `req.url`, then `Host`. The signin route now passes that value through `resolveTrustedAuthHostname`, which falls back to the configured canonical root/www host unless the host is exactly root, www, app, or approved local. `buildAuthCallbackUrl` replaced the suffix-based `endsWith('nabatable.com')` callback builder, and `sendAuthMagicLink` now validates `emailRedirectTo` with `normalizeTrustedMagicLinkRedirect` before Supabase `generateLink` can create a token. The focused regression command `pnpm exec vitest run tests/server/auth/signin-route-magic-link-policy.test.ts tests/server/auth/callback-route-security.test.ts tests/server/auth/magic-link-email.test.ts` passed with 17 tests, including spoofed forwarded/origin headers, suffix-domain callbacks, and helper-level invalid redirect rejection.

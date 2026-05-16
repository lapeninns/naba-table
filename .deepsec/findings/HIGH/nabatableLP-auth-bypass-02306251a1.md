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

## Revalidation

**Verdict:** true-positive

The current parsing and callback construction path matches the finding. parseHostname accepts spoofable forwarded, Origin, and Referer values ahead of the actual Host, while sanitizeRedirect's exact allowed-host logic only applies to redirectedFrom targets and not to the callback hostname itself. In src/app/api/auth/signin/route.ts, buildCallbackUrl accepts any hostname ending in nabatable.com, which is not a registrable-domain or dot-boundary check. Because sendAuthMagicLink builds the final email link with the supplied emailRedirectTo plus token_hash, a poisoned hostname directly controls where the one-time magic-link token is sent. An attacker does not need a victim session to initiate this; they can send a server-side POST with their own CSRF cookie/header pair and a victim email that exists in profiles/user_profiles. Once the victim clicks the official email, the attacker-controlled callback host receives token_hash and can redeem it on the real app before the victim does. Spoofing app.nabatable.com also remains capable of misclassifying public requests as app_ops for the signin surface, which can skip the guest Turnstile branch, although the token-exfiltration case uses an attacker-controlled accepted suffix host. No current file I read validates the parsed hostname against exact root, www, and app hosts before building the magic-link URL.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-29)

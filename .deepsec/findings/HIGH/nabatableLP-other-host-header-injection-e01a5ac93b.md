# [HIGH] Spoofable host headers can poison auth magic-link callback URLs

**File:** [`lib/auth/redirects.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/lib/auth/redirects.ts#L107-L118) (lines 107, 109, 110, 111, 112, 113, 116, 117, 118)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** medium • **Slug:** `other-host-header-injection`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

parseHostname trusts x-forwarded-host, x-original-host, Origin, and Referer before the actual Host/nextUrl hostname, and returns the first parsed value without validating it against the configured root/app hosts. The auth sign-in route uses this hostname to classify the sign-in surface and to build magic-link callback URLs. A server-side attacker can submit a public magic-link request with their own CSRF cookie and a spoofed Origin or X-Forwarded-Host such as https://evilnabatable.com; the caller's suffix check accepts hostnames ending in nabatable.com, so legitimate magic-link emails can be generated with an attacker-controlled callback host. Since the callback link includes token_hash, a victim click can leak a usable magic-link token to the attacker. Spoofing app.nabatable.com also makes public guest requests look like app_ops and skips the guest Turnstile branch.

## Recommendation

Do not use Origin or Referer for trusted host decisions, and only honor forwarded host headers after trusted proxy normalization. Prefer a fixed canonical callback origin or req.nextUrl/Host validated against exact allowed hosts: rootDomain, www.rootDomain, and app.rootDomain with a label boundary. Also harden the auth callback builder so attacker-owned domains that merely end with the brand string are rejected.

## Revalidation

**Verdict:** true-positive

parseHostname still trusts x-forwarded-host, x-original-host, Origin, and Referer before Host or req.nextUrl and returns the first parsed hostname without checking it against the configured root/app host allowlist. The signin route uses that hostname to classify the surface, choose redirects, and build emailRedirectTo for magic-link email delivery. buildCallbackUrl only rejects non-local hostnames that do not end with the literal string nabatable.com, so attacker-owned domains such as evil-nabatable.com or evilnabatable.com pass the suffix check. sendAuthMagicLink then obtains a Supabase hashed token and constructs its own email button URL from emailRedirectTo and token_hash, so the poisoned host becomes the actual link sent to the victim. A direct attacker can satisfy this route's CSRF check with their own matching sr-csrf-token cookie and x-csrf-token header, request a magic link for a known registered victim email, and spoof a host-derived header to place the attacker domain in the email. If the victim clicks the legitimate email, the token_hash is delivered to the attacker-controlled host and can be redeemed against the real /api/auth/callback for a session. The proxy uses Host for routing but does not strip or canonicalize these trusted-by-route headers, and the callback route's trusted-origin logic cannot protect a link that first goes to the attacker domain. Rate limiting, profile lookup, and possible Turnstile enforcement add friction but do not fix the underlying host trust bug.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-29)

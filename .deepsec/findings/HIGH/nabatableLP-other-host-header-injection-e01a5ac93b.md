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

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-29)

# [MEDIUM] QA auth bypass endpoint allows arbitrary external redirects

**File:** [`src/app/api/auth/qa-bypass/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/auth/qa-bypass/route.ts#L22-L28) (lines 22, 25, 28)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

When QA_ENABLE_AUTH_FIXTURES is enabled, the handler reads the redirect query parameter and passes it directly to new URL() before NextResponse.redirect(). Absolute URLs and protocol-relative URLs override the intended base, so /api/auth/qa-bypass?redirect=https://attacker.example redirects users off-site from a trusted Nabatable origin. The fallback base also trusts the Host header, which gives another redirect-control path when Host is attacker-influenced.

## Recommendation

Validate redirect with the existing trusted redirect/local-path sanitizer and only allow same-origin relative paths or an explicit allowlist. Do not build redirect origins from an untrusted Host header.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)

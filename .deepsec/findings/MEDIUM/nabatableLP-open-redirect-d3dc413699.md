# [MEDIUM] Callback redirects trust forwarded host headers

**File:** [`src/app/api/ops/restaurants/[id]/google-business/callback/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business/callback/route.ts#L13-L66) (lines 13, 31, 37, 54, 56, 66)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The callback builds redirect targets with getRequestOrigin(request). That helper prefers x-forwarded-host and then host without an allowlist. Public error paths redirect even when state/code are missing, and the success path also uses the same origin as the base. If the deployment forwards client-supplied Host or X-Forwarded-Host values, a request with X-Forwarded-Host: attacker.example produces a Location header on attacker.example, enabling phishing/open-redirect abuse. OAuth state mitigates token theft, but it does not mitigate the redirect sink.

## Recommendation

Build callback redirects from a configured canonical app origin or validate the resolved host against NEXT_PUBLIC_ROOT_DOMAIN/app host allowlists before redirecting. Do not trust forwarded host headers directly for security-sensitive redirects.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-28)

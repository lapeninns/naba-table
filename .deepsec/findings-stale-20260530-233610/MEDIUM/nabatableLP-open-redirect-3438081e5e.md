# [MEDIUM] OAuth callback redirects trust request host headers

**File:** [`src/app/api/ops/restaurants/[id]/google-business/callback/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/restaurants/[id]/google-business/callback/route.ts#L20-L101) (lines 20, 21, 86, 87, 88, 91, 101)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The callback builds absolute redirect URLs with buildRedirect(), which uses getRequestOrigin(req) as the origin. The traced helper in src/app/api/ops/google-business-profile/\_origin.ts accepts x-forwarded-host or host without checking it against the configured app/root domains. sanitizeGoogleBusinessProfileReturnPath constrains only the path, not the origin, so a request reaching this route with a poisoned forwarded host can produce a Location header on an attacker-controlled origin. The error branches are public and do not require a valid OAuth state, and the success branch uses the same origin construction.

## Recommendation

Build callback redirects from a trusted configured app origin, or strictly allowlist the effective host against NEXT_PUBLIC_ROOT_DOMAIN/app host before using it in a Location header. Keep return-path sanitization, but do not derive the redirect origin from client-controlled forwarding headers.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)

# [MEDIUM] Dual-sync publish POST lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/dual-sync/publish/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/dual-sync/publish/route.ts#L50-L80) (lines 50, 61, 80)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-missing-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route uses cookie-bound session auth through ensureRestaurantAdminAccess and then runs a mutating publish operation with a service client and Google-facing ports, but it never calls validateCsrfToken(). The browser service usually attaches a CSRF header via fetchJson, but the server does not enforce it, so the header provides no protection.

## Recommendation

Validate the CSRF token before parsing the JSON body or running publish, and return 403/419 when the header/cookie pair is missing or invalid.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)

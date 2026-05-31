# [MEDIUM] Auto-export POST lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/dual-sync/auto-export/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/dual-sync/auto-export/route.ts#L37-L66) (lines 37, 48, 53, 66)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-missing-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route authenticates the ambient session and checks admin membership, then invokes runAutoExportForRestaurant with a service client, but it never validates the CSRF token. Because the request body schema is optional and req.json() failures are converted to undefined, a POST without a valid JSON body can still run the default auto-export path.

## Recommendation

Call validateCsrfToken(request) before body parsing or side effects, return 403/419 on failure, and require an explicit JSON body if manual auto-export should not be form-postable.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)

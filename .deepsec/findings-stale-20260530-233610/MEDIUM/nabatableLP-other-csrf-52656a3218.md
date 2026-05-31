# [MEDIUM] State-changing import review POST lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/route.ts#L54-L86) (lines 54, 60, 70, 79, 86)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST authenticates via the Supabase session cookie through ensureRestaurantAdminAccess, then parses request.json() and calls prepareFoodMenusImportReview with a service-role client. With persist omitted, the service defaults to persistent behavior, records snapshots/review rows, and supersedes existing pending import reviews. The handler never calls validateCsrfToken or checks the x-csrf-token header, despite the repo's double-submit CSRF helper being available for session-cookie POST handlers.

## Recommendation

Require validateCsrfToken(request) before parsing or mutating, return 403 on failure, and keep the client fetch path sending x-csrf-token. Consider also rejecting unexpected content types for JSON-only mutation endpoints.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

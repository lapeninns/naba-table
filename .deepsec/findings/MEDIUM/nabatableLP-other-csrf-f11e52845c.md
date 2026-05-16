# [MEDIUM] Missing CSRF validation on persistent session-cookie POST

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/projection/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/projection/route.ts#L21-L56) (lines 21, 27, 46, 56)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler authenticates via the user's Supabase session cookie through ensureRestaurantAdminAccess, then calls prepareFoodMenusProjection with a service-role client. The route never validates the x-csrf-token double-submit token used elsewhere in the app. Because prepareFoodMenusProjection defaults persist to true when payload.persist is omitted, a CSRF-capable same-site origin could cause an authenticated restaurant admin's browser to create Google FoodMenus projection snapshots/identity rows for that restaurant without the admin intending it.

## Recommendation

Import validateCsrfToken from server/security/csrf and reject the request before parsing/mutating when the CSRF header/cookie pair is missing or invalid. Keep using fetchJson on the client so legitimate requests send the token.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

# [MEDIUM] Unthrottled Google FoodMenus refresh mutates review state

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/refresh/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/refresh/route.ts#L52-L73) (lines 52, 60, 73)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

After the admin check, the route calls refreshFoodMenusImportReviewFromGoogle() with the restaurant's Google access token and persists by default when persist is omitted. That flow fetches Google FoodMenus and replaces pending import reviews for the restaurant. There is no consumeRateLimit(), debounce, or idempotency guard, so any restaurant admin or compromised admin session can repeatedly POST {} to consume shared Google API quota and churn pending import-review rows.

## Recommendation

Apply consumeRateLimit() before the Google fetch, keyed by user ID, restaurant ID, and route; add a short per-restaurant refresh debounce or idempotency key; and consider requiring an explicit persist flag for state-changing refreshes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

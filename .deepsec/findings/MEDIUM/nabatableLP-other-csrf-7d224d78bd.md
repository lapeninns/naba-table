# [MEDIUM] FoodMenus refresh mutation lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/refresh/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/refresh/route.ts#L22-L60) (lines 22, 38, 52, 60)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler authorizes the restaurant admin but never validates the CSRF token before parsing the request and calling refreshFoodMenusImportReviewFromGoogle. With persist=true, the downstream code records Google snapshots and supersedes/replaces pending import-review rows. Because request.json() can parse a simple text/plain JSON body, a same-site attacker can trigger this state-changing Google refresh without reading the response.

## Recommendation

Require validateCsrfToken(request) before parsing the body or performing Google/Supabase work. Consider adding action-level rate limiting as this endpoint also calls external Google APIs.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

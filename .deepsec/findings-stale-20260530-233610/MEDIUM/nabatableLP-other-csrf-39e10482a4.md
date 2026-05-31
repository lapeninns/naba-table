# [MEDIUM] FoodMenus review decision POST lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/[reviewId]/decision/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/[reviewId]/decision/route.ts#L48-L79) (lines 48, 60, 70, 79)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler uses cookie-backed admin authentication and then applies a review decision through decideFoodMenusImportReview, but it never validates validateCsrfToken. Decisions can apply menu changes, create items, mark items inactive/sold out, delete local items, or ignore Google changes. A same-site cross-origin page or public-host HTML injection can submit a form POST with a valid JSON body shape and force a logged-in admin browser to make a review decision.

## Recommendation

Require validateCsrfToken(request) for this POST before accepting the decision payload, and return a 419/403 on failure.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

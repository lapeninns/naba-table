# [MEDIUM] Import review POST mutates service-role state without CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/route.ts#L54-L86) (lines 54, 60, 70, 79, 86)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler authenticates the admin through cookie-bound Supabase state but never validates the x-csrf-token double-submit token before parsing request.json() and calling prepareFoodMenusImportReview with the service-role client. A forged same-site request from a browser carrying the admin session could create Google menu snapshots, supersede pending import reviews, or clear the pending review queue by submitting attacker-chosen googleFoodMenus data.

## Recommendation

Import validateCsrfToken from server/security/csrf and reject unsafe POSTs before processing the body or performing service-role writes. Consider also enforcing Content-Type: application/json for this JSON endpoint.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

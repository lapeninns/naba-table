# [MEDIUM] Food menu mutations rely on session cookies without server-side CSRF validation

**File:** [`src/components/features/menu/FoodMenuManagementPanel.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/menu/FoodMenuManagementPanel.tsx#L86-L273) (lines 86, 89, 92, 273)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The panel submits food create/update mutations through `useOpsCreateMenuItem` and `useOpsUpdateMenuItem`, and renders the CSV import dialog for bulk applies. Tracing those flows shows the `/api/ops/restaurants/{id}/menu/items...` and `/api/ops/restaurants/{id}/menu/import` handlers authenticate and check admin membership, but do not call `validateCsrfToken`. The import service also posts credentialed `FormData` without a CSRF header. Forged credentialed requests can mutate food menu data if browser cookie rules allow the request.

## Recommendation

Validate CSRF tokens in the food menu POST/PUT/import route handlers, and add the CSRF header to the import `FormData` request path.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)

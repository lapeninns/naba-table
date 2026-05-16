# [MEDIUM] Food menu mutations are exposed through cookie-authenticated endpoints without CSRF enforcement

**File:** [`src/components/features/menu/FoodMenuManagementPanel.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/menu/FoodMenuManagementPanel.tsx#L89-L276) (lines 89, 92, 273, 276)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The panel wires item saves to createMutation.mutateAsync/updateMutation.mutateAsync and renders the food import dialog for the same restaurantId. The corresponding food item POST/PUT routes and food import POST route perform admin membership checks but never validate the double-submit CSRF token before accepting JSON or multipart mutations. A forged browser request that carries the victim's ops cookies could create/update food items or apply a CSV import.

## Recommendation

Add validateCsrfToken(request) to the food item POST/PUT handlers and the food import POST handler before body parsing. Ensure the import service sends CSRF_HEADER_NAME from getBrowserCsrfToken() like fetchJson does.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

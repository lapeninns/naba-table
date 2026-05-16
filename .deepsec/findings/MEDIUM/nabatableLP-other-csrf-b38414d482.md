# [MEDIUM] Drink create/update mutations rely on session cookies without server-side CSRF validation

**File:** [`src/components/features/menu/DrinkMenuManagementPanel.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/menu/DrinkMenuManagementPanel.tsx#L84-L90) (lines 84, 87, 90)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Finding

The panel submits drink create/update mutations through `useOpsCreateDrinkMenuItem` and `useOpsUpdateDrinkMenuItem`. Tracing those hooks shows POST/PUT requests to `/api/ops/restaurants/{id}/drinks/items...`; the corresponding route handlers authenticate and check admin membership, but do not call `validateCsrfToken`. Although the normal client helper adds an `x-csrf-token` header, the server never enforces it, so forged credentialed requests can mutate drink menu data if browser cookie rules allow the request.

## Recommendation

Validate the double-submit CSRF token in the drink item POST and PUT route handlers before parsing or applying the request body.

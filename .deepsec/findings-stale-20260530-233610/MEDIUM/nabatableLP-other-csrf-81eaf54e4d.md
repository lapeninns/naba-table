# [MEDIUM] Drink item create/update mutations are accepted without server-side CSRF checks

**File:** [`src/components/features/menu/DrinkMenuManagementPanel.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/menu/DrinkMenuManagementPanel.tsx#L87-L90) (lines 87, 90)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The panel wires save actions to createMutation.mutateAsync and updateMutation.mutateAsync. Those reach the drinks item POST/PUT ops routes, which authenticate and validate payloads but do not call validateCsrfToken before creating or updating items. fetchJson adds a CSRF header for legitimate clients, but the server does not require it, so a forged cookie-authenticated request can create or alter drink catalog entries for the victim's active restaurant.

## Recommendation

Add validateCsrfToken(request) checks to the drinks item POST and PUT handlers before parsing JSON, and reject missing/invalid tokens with 419.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)

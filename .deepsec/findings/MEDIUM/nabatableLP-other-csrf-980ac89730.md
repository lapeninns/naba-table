# [MEDIUM] Menu item update does not validate CSRF tokens

**File:** [`src/app/api/ops/restaurants/[id]/menu/items/[itemId]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/menu/items/[itemId]/route.ts#L46-L94) (lines 46, 53, 79, 84, 94)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The PUT handler authenticates an admin and then accepts a JSON body to update menu item data through service-role-backed repository helpers. It never validates the CSRF token, so a same-site attacker/browser context that can send credentialed requests could mutate menu items as the victim admin.

## Recommendation

Call validateCsrfToken(request) before reading the JSON body and reject invalid or missing tokens with 403.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)

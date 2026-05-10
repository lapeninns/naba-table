# [HIGH_BUG] Cloning changes null mobility tables into fixed tables

**File:** [`scripts/clone-restaurant-config.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/clone-restaurant-config.ts#L280-L543) (lines 280, 527, 543)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-config-corruption`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

insertTables copies each source table but converts mobility null to "fixed". The database adjacency trigger treats NULL mobility as movable and eligible for auto-generated zone adjacency, so cloned tables that were effectively movable become fixed and are excluded from adjacency generation. That can silently break merged-table assignment for the cloned restaurant.

## Recommendation

Preserve table.mobility as null, or default it to "movable" to match the database trigger semantics. Add a verification assertion that cloned movable/null-mobility tables produce the expected adjacency rows.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-25)

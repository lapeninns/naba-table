# [HIGH_BUG] Cloned null-mobility tables become fixed tables

**File:** [`scripts/clone-restaurant-config.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/clone-restaurant-config.ts#L280-L543) (lines 280, 543)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-config-corruption`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

insertTables copies source tables but writes mobility: table.mobility ?? "fixed". The zone-adjacency trigger treats NULL mobility as movable, so legacy/null movable tables become fixed in the cloned restaurant and are excluded from generated adjacency rows. That can silently break merged-table assignment for the cloned venue.

## Recommendation

Preserve table.mobility as null, or default null to movable to match the database trigger semantics. Add verification that cloned movable/null-mobility tables produce the expected adjacency rows.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-25)

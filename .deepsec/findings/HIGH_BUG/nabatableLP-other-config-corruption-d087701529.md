# [HIGH_BUG] Tripled tables can lose merge adjacency

**File:** [`scripts/triple-old-school-house-production-tables.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/triple-old-school-house-production-tables.ts#L128-L342) (lines 128, 218, 309, 312, 342)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-config-corruption`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script's projection treats null mobility as movable, but buildClonePlan inserts cloned null-mobility tables as "fixed". The production adjacency trigger treats NULL as movable and "fixed" as ineligible, so dry-run output can predict adjacency capacity that the inserted rows will not actually receive, breaking larger-party merged-table assignment after apply.

## Recommendation

Preserve null mobility or default it to movable in cloned rows, and compare verified adjacencyRows against finalAdjacencyProjection after apply.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-20)

# [BUG] Duplicate table IDs inflate direct assignment validation

**File:** [`server/capacity/table-assignment/direct-assignment.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/capacity/table-assignment/direct-assignment.ts#L214-L410) (lines 214, 297, 299, 410)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

assignTablesDirectly accepts tableIds without checking uniqueness. loadTablesByIds returns a table entry for each requested ID, so a repeated table ID is treated as multiple selected tables during validation and summary generation, double-counting capacity and tableCount. The later assignment path normalizes table IDs before committing, so the API can return one real assignment with an inflated summary; if DB-side capacity enforcement is ever unavailable or weakened, this also becomes a capacity-validation bypass.

## Recommendation

Reject duplicate table IDs at input validation, or normalize once up front and use the unique ID list for loading, validation, assignment, and response summaries.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

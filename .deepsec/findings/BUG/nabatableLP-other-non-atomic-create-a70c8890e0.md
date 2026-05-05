# [BUG] Restaurant creation and owner membership creation are not atomic

**File:** [`server/restaurants/create.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/create.ts#L197-L224) (lines 197, 216, 224)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-non-atomic-create`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

createRestaurant inserts the restaurant, then inserts the owner membership in a second statement. If membership creation fails, it attempts a compensating delete, but the delete result is ignored. A failed compensation can leave an active restaurant with no owner membership, which is hard to recover through normal ops flows.

## Recommendation

Create the restaurant and owner membership inside one database transaction/RPC, or at minimum check and surface compensation-delete failures so orphaned restaurants can be detected and repaired.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

# [HIGH_BUG] Restaurant and owner membership creation are not atomic

**File:** [`server/restaurants/create.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/create.ts#L197-L224) (lines 197, 216, 224)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-write`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

createRestaurant() inserts the restaurant first, then inserts the owner membership. If membership creation fails, it attempts a best-effort delete of the restaurant but ignores any delete error. A delete failure or transient database issue can leave an active restaurant with no owner membership, making it public but unmanageable through normal tenant access.

## Recommendation

Create the restaurant and owner membership in one transactional RPC. If keeping application-side compensation, check and surface cleanup failures and avoid making the restaurant active until membership creation is confirmed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

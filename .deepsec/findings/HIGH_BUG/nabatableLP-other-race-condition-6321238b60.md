# [HIGH_BUG] Non-atomic outbound candidate upsert can drop queued exports

**File:** [`server/dual-sync/outbound/candidates.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/outbound/candidates.ts#L76-L110) (lines 76, 88, 98, 110)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

upsertOutboundCandidate first selects the current open candidate, then updates by id, otherwise inserts a new open row. The database enforces one open row per restaurant/provider/field with a partial unique index, but this helper does not make the read/update/insert atomic. If a publish resolves the selected candidate after the read but before the update, this code updates the now-resolved row because the update only filters by id, leaving no open candidate for the latest Core write. If two Core writes concurrently see no open candidate, one insert can also fail on the unique index instead of retrying as an update. Both cases can silently lose or wedge outbound sync work after a Core change.

## Recommendation

Move this into a database RPC/transaction using an atomic INSERT ... ON CONFLICT ... WHERE status = 'open' DO UPDATE, or take a per-field advisory lock. At minimum, include status = 'open' in the update predicate and retry insert/update on zero rows or unique-violation errors.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)

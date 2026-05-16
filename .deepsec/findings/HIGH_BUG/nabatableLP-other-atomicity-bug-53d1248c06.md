# [HIGH_BUG] Replacing turn bands can wipe settings on partial failure

**File:** [`src/app/api/ops/restaurants/[id]/turn-bands/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/turn-bands/route.ts#L181) (lines 181)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-atomicity-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The PUT handler calls replaceRestaurantTurnBands, whose implementation validates, deletes all existing rows for the restaurant, and then inserts the replacement rows as separate Supabase statements. If the insert fails after the delete, or two replacements interleave, the restaurant can lose all turn-band settings or end with mixed/stale configuration.

## Recommendation

Perform the delete-and-insert replacement inside a single database transaction/RPC, or use an atomic diff/upsert strategy with rollback on failure and concurrency protection.

## Revalidation

**Verdict:** true-positive

The PUT handler calls replaceRestaurantTurnBands after admin and CSRF checks, and that helper still performs separate Supabase statements. server/restaurants/turnBands.ts first loads valid booking options and normalizes the payload, then deletes all restaurant_turn_bands rows for the restaurant, and only afterwards inserts the replacement rows. There is no transaction, RPC, lock, or rollback around the delete and insert sequence. If the insert fails after the delete, for example because of a transient PostgREST/database failure or a concurrent conflicting replacement, the old settings are already committed as deleted. Two concurrent replacements can also interleave after each has deleted the full set, leaving a failed request after another request's insert or a mixed final set when payloads do not collide on the unique key. The current code therefore still has the data-loss atomicity bug described.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

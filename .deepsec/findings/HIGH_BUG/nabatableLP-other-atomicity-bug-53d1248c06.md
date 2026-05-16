# [HIGH_BUG] Replacing turn bands can wipe settings on partial failure

**File:** [`src/app/api/ops/restaurants/[id]/turn-bands/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/turn-bands/route.ts#L181) (lines 181)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-atomicity-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The PUT handler calls replaceRestaurantTurnBands, whose implementation validates, deletes all existing rows for the restaurant, and then inserts the replacement rows as separate Supabase statements. If the insert fails after the delete, or two replacements interleave, the restaurant can lose all turn-band settings or end with mixed/stale configuration.

## Recommendation

Perform the delete-and-insert replacement inside a single database transaction/RPC, or use an atomic diff/upsert strategy with rollback on failure and concurrency protection.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

**Verdict:** fixed

`replaceRestaurantTurnBands` no longer deletes and reinserts `restaurant_turn_bands` from the route/service helper. It normalizes the payload, then calls the service-role-only `replace_restaurant_turn_bands` RPC. The migration defines that RPC as a single transactional replacement: incoming rows are validated, upserted by `(restaurant_id, booking_option, max_party_size)`, and obsolete rows are deleted inside the same function. Focused evidence: `pnpm exec vitest run tests/server/restaurant-schedule-replacements.test.ts tests/server/restaurants/details.test.ts`, targeted ESLint, and `pnpm run typecheck` passed on 2026-05-16.

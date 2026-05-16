# [HIGH_BUG] Canonical GBP row replacement is not transactional

**File:** [`server/google-business-profile/business-info.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/business-info.ts#L1718-L2061) (lines 1718, 1724, 1737, 1999, 2017, 2030, 2054, 2061)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-replace`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

replaceProviderRows deletes existing provider rows and then inserts replacements as separate operations. syncGoogleBusinessProfileCanonicalBusinessInfo performs snapshots, multiple table replacements, field status replacement, and change-log insertion sequentially without a transaction. Any insert/network/validation failure after a delete can leave the restaurant with partially missing or mixed old/new GBP canonical data while snapshots may already record the new upstream payload.

## Recommendation

Move the canonical sync into a database transaction/RPC, or stage new rows and swap them atomically. If a table replacement fails, roll back all table changes and do not commit the snapshot/change-log evidence as applied.

## Revalidation

**Verdict:** fixed

`syncGoogleBusinessProfileCanonicalBusinessInfo` now delegates the canonical GBP sync to the service-role RPC `replace_gbp_canonical_business_info` instead of issuing separate snapshot, delete, insert, field-status, and change-log calls. The migration `supabase/migrations/20260516090500_atomic_gbp_canonical_business_info.sql` performs the snapshot inserts, GBP-owned row replacements, field-sync status replacement, and profile change-log insert inside one PostgreSQL function with an advisory transaction lock. If any table replacement fails, the function call rolls back as a single transaction and no applied snapshot/change-log evidence is committed independently.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)

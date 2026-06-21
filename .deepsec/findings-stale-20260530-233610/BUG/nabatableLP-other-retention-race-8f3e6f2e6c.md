# [BUG] Archived request logs can become permanently undeletable after partial retention failure

**File:** [`server/dual-sync/publish/google-request-log-retention.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/dual-sync/publish/google-request-log-retention.ts#L110-L118) (lines 110, 118)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-retention-race`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

pruneExpiredGoogleRequestLogs first selects expired log rows, inserts archive rows, and then deletes the original IDs in separate database calls. The archive table has a unique index on original_request_log_id, so if the archive insert succeeds but the subsequent delete fails or the process exits before deletion, later retention runs will try to insert the same archive records again, hit the unique constraint, throw at archiveError, and never reach the delete step. This can permanently strand expired rows in the hot request-log table until manual repair. The in-process cron lock does not eliminate this because crashes/transient DB failures and multi-instance execution can still split the archive/delete sequence.

## Recommendation

Move the archive-and-delete sequence into a single database transaction or RPC. Use a CTE with row locking/SKIP LOCKED, insert archives with ON CONFLICT DO NOTHING, and delete only rows whose archive record exists. Alternatively, make the TypeScript path idempotent by tolerating existing archive rows before deleting the corresponding expired log IDs.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)

# [HIGH_BUG] Dual-sync lock can expire while the protected job is still running

**File:** [`server/dual-sync/locks.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/dual-sync/locks.ts#L22-L183) (lines 22, 98, 102, 114, 168, 178, 183)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-lock-ttl-race`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The lock is a time-limited lease with a 5 minute default TTL, but runWithDualSyncLock does not renew the lease or fence writes while the async refresh/publish work is running. A second job arriving after expires_at can mark the still-running job's held lock as expired and insert a new held lock for the same restaurant/provider, so two write-affecting dual-sync jobs can mutate field state, candidates, mirrors, or Google concurrently. The public route callers use the default TTL, and refresh/publish/auto-export paths include external Google calls and database work that can plausibly exceed the lease.

## Recommendation

Use a lock mechanism that remains valid for the whole job: renew/heartbeat the lease during work and abort if renewal fails, or use a database advisory lock/transactional queue claim. Add a fencing token/holder check to write paths so an expired holder cannot continue mutating state after another holder acquires the lock. Treat stale-lock recovery as a separate operation rather than expiring active work solely by wall-clock TTL.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)

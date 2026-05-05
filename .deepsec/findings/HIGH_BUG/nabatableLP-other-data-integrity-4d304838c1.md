# [HIGH_BUG] Fallback assignment sync ignores Supabase write errors

**File:** [`server/capacity/table-assignment/assignment-sync.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/assignment-sync.ts#L149-L235) (lines 149, 157, 159, 168, 181, 224, 235)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-data-integrity`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

When sync_confirmed_assignment_windows fails, the fallback path performs several Supabase update calls inside try/catch blocks but never checks the returned error objects. supabase-js does not throw for PostgREST write failures, so assignment window, allocation window, or idempotency ledger updates can fail while the code reloads existing rows and returns success using the requested startIso/endIso. That can leave persisted assignment windows stale while downstream callers believe the sync completed.

## Recommendation

Only enter fallback for known missing-RPC/schema-cache cases, inspect every Supabase write result for error, verify reloaded rows have the expected start/end/merge_group_id, and fail closed if any write did not apply. Prefer a single transactional RPC.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-17)

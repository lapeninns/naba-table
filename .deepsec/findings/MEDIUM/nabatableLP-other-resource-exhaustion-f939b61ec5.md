# [MEDIUM] Restaurant logo uploads have no quota or rate limit

**File:** [`src/app/api/ops/restaurants/[id]/logo/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/logo/route.ts#L68-L141) (lines 68, 90, 125, 133, 136, 141)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-resource-exhaustion`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The route correctly requires owner/manager membership, but each successful request writes a new public object with a unique random path via the service-role client. The 2 MB per-file limit only caps individual requests; a tenant admin or compromised admin session can repeatedly upload files to consume Supabase storage and leave unreferenced public objects.

## Recommendation

Add per-user/per-restaurant rate limits and storage quotas, delete or overwrite prior logo objects when replacing a logo, and consider validating/rasterizing uploaded images before storing them publicly.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-27)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

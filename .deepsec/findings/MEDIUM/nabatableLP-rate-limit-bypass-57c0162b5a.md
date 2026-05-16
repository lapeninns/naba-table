# [MEDIUM] Avatar uploads can be abused for storage exhaustion

**File:** [`src/app/api/profile/image/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/profile/image/route.ts#L88-L105) (lines 88, 96, 100, 105)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

Any authenticated user can repeatedly upload 2 MB files to a public Supabase Storage bucket through the service-role client. Each upload gets a unique path and there is no rate limit, per-user quota, or cleanup of abandoned avatars, enabling storage/CDN resource abuse by low-privilege accounts.

## Recommendation

Add per-user upload rate limits, enforce user storage quotas, and delete or expire replaced/unreferenced avatar objects.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

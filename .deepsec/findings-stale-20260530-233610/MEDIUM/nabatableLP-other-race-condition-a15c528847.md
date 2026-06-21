# [MEDIUM] Hold conflict enforcement can fail open behind a runtime flag

**File:** [`server/feature-flags.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/feature-flags.ts#L165-L256) (lines 165, 166, 167, 255, 256)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

isHoldStrictConflictsEnabled() resolves a DB/env override and can return false while holds remain enabled; validateFeatureFlagSafety() only logs a warning. The traced hold code uses this value to configure the DB conflict-enforcement session and falls back to legacy read-before-insert checks when strict conflicts are off. Concurrent hold creation can therefore race into overlapping table holds if the write-side DB enforcement is disabled.

## Recommendation

Make active hold overlap prevention fail closed and independent of a runtime override. Keep DB-level conflict enforcement on for writes, and treat conflict-verification failures as errors rather than legacy fallbacks.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-20)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

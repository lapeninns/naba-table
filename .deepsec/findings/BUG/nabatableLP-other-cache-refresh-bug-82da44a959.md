# [BUG] Empty feature-flag override sets are never treated as cached

**File:** [`server/feature-flags-overrides.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/feature-flags-overrides.ts#L61-L77) (lines 61, 62, 73, 77)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-cache-refresh-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

refreshOverrides stores the fetched Map and sets expiresAt, but ensureRefreshScheduled only treats the cache as valid when now < expiresAt AND cache.data.size > 0. If the feature_flag_overrides table has no matching rows for the environment, every getFeatureFlagOverride call after the previous refresh settles schedules another service-role database fetch despite the TTL. On high-traffic booking/capacity paths that read these flags, a normal empty override set can cause avoidable repeated database load.

## Recommendation

Track cache freshness separately from whether the override Map is empty. For example, return early whenever now < cache.expiresAt, and use a separate initialized flag if cold-cache behavior must be distinguished.

## Revalidation

**Verdict:** fixed

`server/feature-flags-overrides.ts` now treats the override cache as fresh whenever `Date.now() < cache.expiresAt`, even when the fetched override map is empty. Normal environments with no override rows no longer repeatedly hit Supabase until the TTL expires.

Evidence: `pnpm exec vitest run tests/server/feature-flags.test.ts` passed on 2026-05-16. `pnpm exec prettier --check server/feature-flags-overrides.ts tests/server/feature-flags.test.ts` also passed.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-29)

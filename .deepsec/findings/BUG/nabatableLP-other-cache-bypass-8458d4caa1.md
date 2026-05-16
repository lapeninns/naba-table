# [BUG] Empty or failed override fetches are not cached despite setting a TTL

**File:** [`server/feature-flags-overrides.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/feature-flags-overrides.ts#L61-L76) (lines 61, 62, 67, 73, 76)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-cache-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

refreshOverrides sets cache.expiresAt after both successful and failed fetches, but ensureRefreshScheduled only honors the TTL when cache.data.size is greater than zero. If there are no overrides for an environment, or Supabase returns an error and refreshOverrides stores an empty map, every subsequent getFeatureFlagOverride call schedules another service-role database refresh instead of waiting for the TTL.

## Recommendation

Honor expiresAt independently of data.size, or track an initialized/lastRefresh status so an empty override set and temporary fetch failure are cached for the intended TTL.

## Revalidation

**Verdict:** fixed

`server/feature-flags-overrides.ts` now honors `cache.expiresAt` independently of the override map size. Empty override sets and temporary fetch failures are cached for the intended TTL instead of scheduling a new service-role read on every flag access.

Evidence: `pnpm exec vitest run tests/server/feature-flags.test.ts` passed on 2026-05-16. `pnpm exec prettier --check server/feature-flags-overrides.ts tests/server/feature-flags.test.ts` also passed.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-29)

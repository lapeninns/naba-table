# [MEDIUM] Google publish endpoint has no server-side throttling

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/publish/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/publish/route.ts#L46-L55) (lines 46, 49, 55)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

After admin authorization, the route uses the service client and calls publishFoodMenusProjectionToGoogle, which performs Google read/write API calls and records publish attempts. There is no consumeRateLimit call or restaurant-level publish lock in this handler, so a compromised or malicious admin account can repeatedly burn Google API quota and create repeated external menu updates.

## Recommendation

Add rate limiting keyed by user, restaurant, and endpoint, and consider a short per-restaurant publish cooldown or in-flight lock.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

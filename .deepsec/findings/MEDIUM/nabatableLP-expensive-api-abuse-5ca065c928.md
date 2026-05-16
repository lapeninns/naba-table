# [MEDIUM] Manual Google refresh lacks abuse controls

**File:** [`src/app/api/ops/restaurants/[id]/dual-sync/refresh/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/dual-sync/refresh/route.ts#L26-L41) (lines 26, 37, 41)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler authenticates the caller as a restaurant admin, but then calls refreshFromGoogle with the service-role client without any per-user/restaurant/IP rate limit or CSRF validation. refreshFromGoogle performs a live Google Business Profile pull and persists snapshot/state rows, so a compromised admin session or same-site CSRF primitive can repeatedly trigger external API calls and database writes, exhausting provider quota and creating operational churn.

## Recommendation

Validate the ops CSRF token before running the refresh, add consumeRateLimit keyed by userId/restaurantId/IP, and consider a short per-restaurant refresh lock/debounce.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

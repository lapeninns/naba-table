# [BUG] Realtime-enabled timeline disables polling without a failure fallback

**File:** [`src/hooks/ops/useOpsTableTimeline.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/hooks/ops/useOpsTableTimeline.ts#L62-L104) (lines 62, 68, 104)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-stale-data`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

When realtime is enabled, the hook sets React Query's refetchInterval to false, then calls channel.subscribe() without a status callback or error handler. If the Supabase realtime subscription times out, is unauthorized, is not configured for the table, or later closes, the hook never marks realtime unhealthy and never falls back to the 10s polling path. Because refetchOnWindowFocus is also disabled, operators can keep viewing stale allocation/hold data until a manual refresh or remount. The HTTP timeline fetch path is authenticated and membership-checked, so this is not an auth bypass, but stale table availability can materially break capacity operations.

## Recommendation

Track subscription health with the subscribe status callback. Keep polling enabled until the channel reaches SUBSCRIBED, and re-enable polling on TIMED_OUT, CHANNEL_ERROR, or CLOSED. Consider exposing a realtimeHealthy state similar to other ops realtime hooks.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

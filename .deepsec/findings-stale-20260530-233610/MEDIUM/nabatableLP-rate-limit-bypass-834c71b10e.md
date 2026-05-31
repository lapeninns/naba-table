# [MEDIUM] Unthrottled auto-quote endpoint can exhaust table holds

**File:** [`src/app/api/staff/auto/quote/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/staff/auto/quote/route.ts#L21-L89) (lines 21, 80, 83, 89)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST authenticates the user and checks restaurant membership, but it never applies requireApiRateLimit or any per-user/per-tenant cap before calling quoteTables. The traced quoteTables path creates real table_holds with caller-controlled TTL up to 600 seconds. A valid restaurant member can repeatedly call this endpoint for a booking, forcing the planner to skip already-held candidates and place additional holds, temporarily blocking availability across the restaurant.

## Recommendation

Add a tenant- and user-scoped rate limit before quoteTables, and consider a per-booking active-hold cap or replacement semantics so repeated quote requests by the same actor cannot accumulate holds indefinitely.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-07)

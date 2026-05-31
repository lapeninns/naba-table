# [MEDIUM] Unbounded table batch creates unlimited concurrent service-role writes

**File:** [`src/app/api/onboarding/restaurant/[id]/tables/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/onboarding/restaurant/[id]/tables/route.ts#L25-L96) (lines 25, 26, 95, 96)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-resource-exhaustion`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route correctly checks restaurant owner/manager authorization, CSRF, and zone ownership. The remaining issue is abuse resistance: tables is an unbounded array, tableNumber and numeric fields lack practical maxima, and the handler fans the entire batch into Promise.all service-role inserts. A newly onboarded owner can create a zone, then send one large request that causes thousands of concurrent Supabase writes and persistent table_inventory rows for the tenant, consuming shared database/API resources. There is no rate limit on this mutation.

## Recommendation

Add requireApiRateLimit scoped by user and restaurant, cap batch size and field lengths/numeric ranges, and insert in bounded chunks or a capped bulk operation.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)

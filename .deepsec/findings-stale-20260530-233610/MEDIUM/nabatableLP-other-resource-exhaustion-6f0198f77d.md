# [MEDIUM] Unbounded tenant service-client cache can be grown from public restaurantId input

**File:** [`server/supabase.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/supabase.ts#L16-L230) (lines 16, 204, 209, 230)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-resource-exhaustion`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getTenantServiceSupabaseClient() memoizes a service-role Supabase client for every non-empty restaurantId in a module-global Map with no TTL or size bound. A shipped public guest lookup path accepts an optional restaurantId query parameter validated only as a UUID, calls tenantClientFor(targetRestaurantId) before rate limiting, and keys the limiter by that same attacker-controlled restaurantId. An unauthenticated attacker can send many requests with unique UUIDs and valid-looking contact fields, creating unbounded cached clients while also avoiding a single stable rate-limit bucket. This can drive process memory growth and instance churn.

## Recommendation

Move rate limiting before tenant client creation and include an IP-only/global bucket for lookup attempts. Validate that the restaurant exists before creating a tenant client. Bound tenantClientCache with an LRU/TTL, or avoid memoizing clients for request-supplied IDs.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-24)

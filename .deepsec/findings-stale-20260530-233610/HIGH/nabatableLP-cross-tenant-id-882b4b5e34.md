# [HIGH] Service-role onboarding caller can create zones in another tenant

**File:** [`server/ops/zones.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/ops/zones.ts#L39-L47) (lines 39, 40, 41, 47)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

createZone directly inserts input.restaurantId into zones without binding it to the authenticated user. The traced caller at src/app/api/onboarding/restaurant/[id]/zones/route.ts takes the restaurant id from the URL, checks only CSRF plus that a Supabase user exists, then calls createZone with getServiceSupabaseClient(), which bypasses RLS. An authenticated attacker who knows a victim restaurant UUID can POST zones under that tenant and alter their floor/capacity configuration.

## Recommendation

Require requireAdminMembership or an equivalent owner/admin binding check for the route restaurant id before calling createZone with a service-role client. Prefer making the helper accept an already-authorized restaurant context or enforcing the restaurant predicate inside the write path.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-24)

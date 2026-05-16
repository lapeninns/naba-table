# [HIGH] Tenant service client uses service role without enforcing tenant scope

**File:** [`server/supabase.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/supabase.ts#L197-L218) (lines 197, 198, 201, 212, 217, 218)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** medium • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getTenantServiceSupabaseClient() creates a Supabase client with the service-role key and only adds an X-Restaurant-Id header. Service-role clients bypass RLS, and the repository does not show policies using this header as an enforcement boundary. Callers that rely on this helper as tenant-scoped can leak or mutate cross-tenant data if they omit explicit restaurant_id filters; one traced assignment-context caller uses this client for a bookings query filtered only by booking_date.

## Recommendation

Do not treat a service-role client plus header as a tenant boundary. Use explicit per-route membership checks and restaurant_id predicates, or move tenant-scoped operations into RPCs that set and enforce tenant context under a non-bypass role.

## Revalidation

**Verdict:** false-positive

The helper is misleading and risky, but I could not confirm a current exploitable cross-tenant path from this finding. `getTenantServiceSupabaseClient` does create a service-role client and only adds an `X-Restaurant-Id` header, and I found no SQL migration policy reading that header. However, service-role clients bypass RLS, so the header is not itself an enforcement boundary; exploitation depends on a caller omitting explicit tenant predicates or prior authorization. I traced the current consumers: the public booking lookup filters by `restaurant_id`, assignment context now filters context bookings by `.eq('restaurant_id', restaurantId)`, and ops/staff assignment routes first resolve the booking or hold and verify membership before using the tenant client. The specific cited assignment-context pattern of filtering bookings only by `booking_date` is not present in the current code. This should still be cleaned up as a dangerous abstraction, but the reported current exploit is not demonstrated.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-21)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-24)

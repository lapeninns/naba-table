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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-21)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-24)

**Verdict:** fixed

The originally cited cross-tenant assignment-context query is no longer present: current consumers resolve or receive an authorized restaurant context and use explicit `restaurant_id` predicates before tenant-specific reads/writes. The misleading helper contract has also been hardened in `server/supabase.ts`: `getTenantServiceSupabaseClient` now documents that the `X-Restaurant-Id` header is for logging/RPC context only, not an isolation boundary, because service-role clients bypass RLS. Callers are explicitly required to enforce membership and restaurant predicates themselves. This closes the demonstrated issue as a code-contract hardening rather than an RLS-header enforcement claim.

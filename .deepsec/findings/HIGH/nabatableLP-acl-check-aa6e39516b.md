# [HIGH] Admin-only turn-band settings are bypassable through direct Supabase RLS access

**File:** [`src/app/api/ops/restaurants/[id]/turn-bands/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/turn-bands/route.ts#L157-L181) (lines 157, 180, 181)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** medium • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route correctly requires requireAdminMembership before replacing turn bands, but the related database policy in supabase/migrations/20260203_add_operating_hours_reservation_slots.sql grants SELECT, INSERT, DELETE, and UPDATE on restaurant_turn_bands to authenticated users and creates a "Staff can manage turn bands" policy using restaurant_id IN public.user_restaurants() with no owner/manager role predicate. A host/server member can bypass this API route entirely and call Supabase REST directly with their authenticated session to modify turn bands for their restaurant, even though this route treats the operation as admin-only.

## Recommendation

Tighten restaurant_turn_bands RLS to owner/manager roles, or revoke authenticated write grants and force all writes through the admin-checked route/service role path.

## Revalidation

**Verdict:** fixed

The route itself still requires a real user session and then calls requireAdminMembership before reading or replacing turn bands. The original migration did grant authenticated users broad access through the permissive Staff can manage turn bands policy, but the current tree adds supabase/migrations/20260505141000_restrict_capacity_settings_mutations.sql. That migration creates restrictive INSERT, UPDATE, and DELETE policies on restaurant_turn_bands using public.user_restaurants_with_roles(ARRAY['owner','manager']). In PostgreSQL RLS, a host/server member may still satisfy the older permissive membership policy, but they cannot satisfy the restrictive owner/manager write predicate. The authenticated GRANT remains, but GRANT alone does not bypass RLS, so direct Supabase REST writes by non-admin staff are blocked in the current schema. I did not verify whether the migration has been applied to the remote database, but the repository state patches the described write bypass.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

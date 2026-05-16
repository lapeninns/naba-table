# [HIGH] Admin-only turn-band settings are bypassable through direct Supabase RLS access

**File:** [`src/app/api/ops/restaurants/[id]/turn-bands/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/turn-bands/route.ts#L157-L181) (lines 157, 180, 181)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** medium • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The route correctly requires requireAdminMembership before replacing turn bands, but the related database policy in supabase/migrations/20260203_add_operating_hours_reservation_slots.sql grants SELECT, INSERT, DELETE, and UPDATE on restaurant_turn_bands to authenticated users and creates a "Staff can manage turn bands" policy using restaurant_id IN public.user_restaurants() with no owner/manager role predicate. A host/server member can bypass this API route entirely and call Supabase REST directly with their authenticated session to modify turn bands for their restaurant, even though this route treats the operation as admin-only.

## Recommendation

Tighten restaurant_turn_bands RLS to owner/manager roles, or revoke authenticated write grants and force all writes through the admin-checked route/service role path.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

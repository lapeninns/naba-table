# [HIGH] Drink menu RPCs can bypass app-layer authorization if left executable by PUBLIC

**File:** [`server/drinks-menu/repository.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/drinks-menu/repository.ts#L389-L447) (lines 389, 447)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The repository calls the privileged RPCs upsert_restaurant_drink_menu_item_with_modifiers and import_restaurant_drink_menu_bundle. The app routes that call this repository do perform requireAdminMembership first, but the backing migration defines both RPCs as SECURITY DEFINER and grants service_role without revoking the default PUBLIC function EXECUTE privilege. In PostgreSQL, new functions are executable by PUBLIC unless explicitly revoked, so an anon/authenticated Supabase client can call /rest/v1/rpc/upsert_restaurant_drink_menu_item_with_modifiers or /rest/v1/rpc/import_restaurant_drink_menu_bundle directly with an arbitrary p_restaurant_id. The functions do not check auth.uid(), membership, or role, and SECURITY DEFINER bypasses RLS, allowing cross-tenant creation/update of drink menu items and modifier deletion/replacement outside the Next.js admin routes.

## Recommendation

Add a migration that revokes EXECUTE on both drink menu RPCs from PUBLIC, anon, and authenticated, then grants only service_role. Consider adding in-function membership checks for any RPC intended to be callable by authenticated users, and add a permission regression test or migration lint that fails SECURITY DEFINER functions without an explicit REVOKE FROM PUBLIC.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

# [HIGH] Soft-hold RPCs lack tenant authorization

**File:** [`server/capacity/table-assignment/soft-holds.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/soft-holds.ts#L199-L330) (lines 199, 200, 203, 206, 242, 244, 330)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

acquireSoftHolds forwards caller-controlled tableIds and restaurantId into acquire_soft_holds_atomic, while releaseSoftHolds releases holds by session token only. The related migrations define these RPCs as SECURITY DEFINER and grant EXECUTE to authenticated users, but the RPCs do not verify auth.uid() membership, do not verify that all table IDs belong to the supplied restaurant, and release by token alone. Because acquire_soft_holds_atomic returns blocking_session on conflicts, an authenticated Supabase user who knows a table UUID can call the RPC directly to create or extend holds outside their tenant, learn another hold token, and release another operator's soft hold. The TypeScript wrapper clamps TTL, but the database RPC itself does not, so direct callers can bypass the wrapper limit.

## Recommendation

Revoke authenticated EXECUTE unless these RPCs are strictly server-only. If direct authenticated RPC access is required, enforce restaurant membership and table-restaurant consistency inside each SECURITY DEFINER function, clamp TTL in the database, and scope release/check operations by authenticated user or restaurant rather than session token alone.

## Revalidation

**Verdict:** true-positive

This is a real database-level authorization gap, not just a helper-layer concern. The TypeScript clamp only applies when callers use acquireSoftHolds; direct authenticated RPC callers can pass p_ttl_seconds directly because the PL/pgSQL function does not clamp it. The function inserts a hold for any valid table_id and any valid restaurant_id supplied by the caller, without checking table ownership or caller membership. release_soft_holds deletes by p_session_token alone, so a leaked or conflict-returned token is enough to remove another user's hold. The migration history I checked still grants these functions to authenticated and does not add ownership checks. A concrete attack is an authenticated user calling the RPC with a victim table UUID and a long TTL to block assignment, then using returned blocking_session values to clear competing holds.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

# [MEDIUM] Soft-hold RPCs are usable without tenant ownership checks

**File:** [`server/capacity/table-assignment/soft-holds.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/soft-holds.ts#L199-L330) (lines 199, 203, 244, 330)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The wrapper sends caller-controlled tableIds, restaurantId, sessionToken, and TTL to acquire_soft_holds_atomic, and releaseSoftHolds later releases holds by session token only. The related migrations grant these SECURITY DEFINER RPCs to authenticated users, while the RPC inserts/releases by table/session without checking that auth.uid() is a member of the restaurant or that all tables belong to the claimed restaurant. Because conflict results include blocking_session and release_soft_holds accepts only that token, an authenticated Supabase user who knows table UUIDs can directly call the RPCs to lock tables, discover another soft-hold token, and release another operator's soft hold.

## Recommendation

Revoke authenticated EXECUTE and keep these RPCs server-only, or add membership and table-restaurant validation inside the SECURITY DEFINER functions. Do not return blocking session tokens to client-callable RPCs, and bind release to restaurant/booking/creator ownership.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

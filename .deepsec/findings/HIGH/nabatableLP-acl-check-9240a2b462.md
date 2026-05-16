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

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

**Verdict:** fixed

This was a true-positive database-level authorization gap. It is fixed by `supabase/migrations/20260516070700_harden_soft_hold_rpc_authorization.sql`.

The migration keeps the application path server-only by revoking `PUBLIC`, `anon`, and `authenticated` execution on `acquire_soft_holds_atomic`, `release_soft_holds`, `check_soft_hold_ownership`, and `cleanup_expired_soft_holds`, then granting execute only to `service_role`. Current shipped callers already authorize the operator in Next.js route handlers before constructing service clients, so direct authenticated Supabase RPC execution is no longer part of the supported contract.

The migration also hardens `acquire_soft_holds_atomic` itself: database-side TTL is clamped to 5-30 seconds, every requested table must exist in `table_inventory` for `p_restaurant_id`, an optional `p_booking_id` must belong to that restaurant, and conflict rows no longer return another session token through `blocking_session`.

Evidence:

- `pnpm exec vitest run tests/server/capacity/soft-holds-rpc-security.test.ts` passed: 3 tests.
- `pnpm run security:regression` passed after adding the new soft-hold regression to the pack: 17 files, 113 tests.
- `pnpm run security:guard:service-role` passed with the existing baseline: 7 existing exceptions, 0 new violations.
- `pnpm exec eslint --max-warnings=0 tests/server/capacity/soft-holds-rpc-security.test.ts` passed.
- `pnpm exec prettier --check package.json tests/server/capacity/soft-holds-rpc-security.test.ts tasks/deepsec-high-remediation-20260516-0659/research.md tasks/deepsec-high-remediation-20260516-0659/plan.md tasks/deepsec-high-remediation-20260516-0659/todo.md tasks/deepsec-high-remediation-20260516-0659/verification.md CONTINUITY.md` passed.

Not yet applied to remote Supabase in this pass. Staging/prod apply remains a deployment step.

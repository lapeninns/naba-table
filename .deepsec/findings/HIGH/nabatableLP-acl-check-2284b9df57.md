# [HIGH] Occasion mutations rely on handlers with no backend admin authorization

**File:** [`src/services/ops/occasions.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/occasions.ts#L53-L72) (lines 53, 54, 62, 63, 71, 72)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The service exposes create, update, and delete calls for global booking occasions. Tracing the handlers shows POST /api/ops/occasions and PATCH/DELETE /api/ops/occasions/[key] only require a Supabase user, then use getServiceSupabaseClient to write booking_occasions; they do not call fetchUserMemberships, requireMembershipForRestaurant, or requireAdminMembership. Relying on src/proxy.ts is only middleware-tier auth, and even when it runs it proves only some membership, not owner/manager authorization. A low-privilege ops user could modify global occasion definitions across restaurants.

## Recommendation

Move authorization into the occasion route handlers: require an authenticated ops membership plus an owner/manager role or a dedicated platform-admin permission before any service-role occasion write.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

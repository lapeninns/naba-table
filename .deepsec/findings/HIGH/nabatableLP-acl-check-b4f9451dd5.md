# [HIGH] Occasion creation lacks backend admin authorization

**File:** [`src/app/api/ops/occasions/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/occasions/route.ts#L33-L133) (lines 33, 34, 46, 78, 116, 128, 133)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The POST handler only verifies that a Supabase user exists. It never calls requireMembershipForRestaurant(), requireAdminMembership(), or a platform-admin guard before using the service-role client to query/upsert booking_occasions and write audit rows. In this codebase, the proxy-level requireOpsAuth guard is not a sufficient mitigation and only proves some restaurant membership. Any authenticated ops member, including lower-privilege host/server users, can create or reactivate global booking occasion definitions. Because booking_occasions is not restaurant-scoped, this can affect availability/occasion behavior across tenants.

## Recommendation

Add a backend authorization check before any service-role access. For global occasion definitions, require a dedicated platform-admin permission; if occasions are intended to be restaurant-scoped, add restaurant_id to the route/data model and requireAdminMembership() for that restaurant before mutation.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-23)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

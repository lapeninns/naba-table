# [HIGH] Any authenticated user can mutate the global occasion catalog

**File:** [`src/app/api/ops/occasions/[key]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/occasions/[key]/route.ts#L20-L135) (lines 20, 33, 66, 106, 110, 135)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

PATCH and DELETE only require supabase.auth.getUser() to return a user. They do not require restaurant membership, admin role, or a platform-admin permission before switching to getServiceSupabaseClient and updating booking_occasions. Because booking occasions are a global catalog used by staff and guest booking flows, any authenticated account that can reach this handler can rename, disable, reorder, change availability for, or soft-delete non-builtin occasions across all tenants.

## Recommendation

Require an explicit privileged authorization check before service-role mutations, such as a platform-admin guard or at least requireAdminMembership for the relevant restaurant-scoped settings flow. Avoid using the service-role client until that authorization has succeeded.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

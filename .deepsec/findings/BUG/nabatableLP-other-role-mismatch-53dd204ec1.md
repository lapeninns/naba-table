# [BUG] Manager role is incorrectly denied table deletion

**File:** [`src/app/api/ops/tables/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/tables/[id]/route.ts#L326-L328) (lines 326, 328)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-role-mismatch`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The delete route allows roles owner and admin, but the repo's canonical admin roles are owner and manager; admin is not one of the defined restaurant roles. The UI enables table deletion for isRestaurantAdminRole(), so managers can see the delete control but receive a 403 from the backend.

## Recommendation

Replace the hard-coded role array with requireAdminMembership or RESTAURANT_ADMIN_ROLES so backend behavior matches the canonical role model.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

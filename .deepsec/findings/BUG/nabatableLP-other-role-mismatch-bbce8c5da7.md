# [BUG] Managers are incorrectly blocked from table deletion

**File:** [`src/app/api/ops/tables/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/tables/[id]/route.ts#L326) (lines 326)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-role-mismatch`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The delete role check allows owner or admin, but the project role constants are owner, manager, host, and server; admin is not a valid current role. The UI uses isRestaurantAdminRole, which treats owner and manager as admins, so managers are shown delete controls but receive a 403 from this route.

## Recommendation

Use the shared RESTAURANT_ADMIN_ROLES/isRestaurantAdminRole logic if managers should delete tables, or align the UI and response text if deletion is intentionally owner-only.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

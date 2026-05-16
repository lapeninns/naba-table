# [BUG] Managers are incorrectly blocked from table deletion

**File:** [`src/app/api/ops/tables/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/tables/[id]/route.ts#L326) (lines 326)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-role-mismatch`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The delete role check allows owner or admin, but the project role constants are owner, manager, host, and server; admin is not a valid current role. The UI uses isRestaurantAdminRole, which treats owner and manager as admins, so managers are shown delete controls but receive a 403 from this route.

## Recommendation

Use the shared RESTAURANT_ADMIN_ROLES/isRestaurantAdminRole logic if managers should delete tables, or align the UI and response text if deletion is intentionally owner-only.

## Revalidation

**Verdict:** fixed

This is the duplicate manager-role finding, and it is fixed in the current code. The backend deletion guard now calls isRestaurantAdminRole rather than checking for owner or a nonexistent admin role. That helper treats owner and manager as admin roles. A manager with a valid restaurant membership can pass the role check and proceed to the assignment-safety check. The previous UI/backend mismatch is no longer present in this handler.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

# [BUG] Manager role is incorrectly denied table deletion

**File:** [`src/app/api/ops/tables/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/tables/[id]/route.ts#L326-L328) (lines 326, 328)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-role-mismatch`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The delete route allows roles owner and admin, but the repo's canonical admin roles are owner and manager; admin is not one of the defined restaurant roles. The UI enables table deletion for isRestaurantAdminRole(), so managers can see the delete control but receive a 403 from the backend.

## Recommendation

Replace the hard-coded role array with requireAdminMembership or RESTAURANT_ADMIN_ROLES so backend behavior matches the canonical role model.

## Revalidation

**Verdict:** fixed

The current DELETE handler no longer checks a hard-coded owner/admin role array. It loads the membership role and calls isRestaurantAdminRole(membership.role). lib/owner/auth/roles.ts defines RESTAURANT_ADMIN_ROLES as owner and manager, and admin is not included. Therefore managers are now accepted by the backend for table deletion, matching the canonical role model and the UI's admin-role predicate. Non-admin host/server roles are still rejected with a 403.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

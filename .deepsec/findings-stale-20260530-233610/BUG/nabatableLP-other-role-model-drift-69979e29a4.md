# [BUG] Grant script writes obsolete membership roles

**File:** [`scripts/grant-restaurant-access.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/grant-restaurant-access.ts#L27-L174) (lines 27, 160, 174)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-role-model-drift`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script allows ROLE values of owner, admin, staff, and viewer, then writes that value directly into restaurant_memberships on insert or update. The canonical role model traced in lib/owner/auth/roles.ts is owner, manager, host, and server. As a result, this operator script can reject valid current roles such as manager/host/server and can create obsolete admin/staff/viewer memberships that downstream guards may treat inconsistently.

## Recommendation

Import or mirror the canonical RESTAURANT_ROLE_OPTIONS from lib/owner/auth/roles.ts and restrict this script to owner, manager, host, and server. Consider failing if an existing membership has a non-canonical role.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

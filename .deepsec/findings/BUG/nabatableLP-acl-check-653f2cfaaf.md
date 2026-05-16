# [BUG] Restaurant settings route lacks an admin role guard

**File:** [`src/app/app/(app)/settings/restaurant/layout.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/settings/restaurant/layout.tsx#L10-L24>) (lines 10, 20, 24)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

RestaurantSettingsLayout only verifies that a Supabase user exists, then renders the restaurant settings shell for any authenticated ops user. The child settings client selects any active membership and renders sensitive settings views, including table and zone management. Tracing those paths shows TableInventoryClient exposes create/update table and zone mutations, while the backing table/zone APIs check only for a membership row and do not require owner/manager admin membership. A host/server member can therefore access /app/settings/restaurant/tables and modify capacity-affecting table or zone configuration despite canManageSettings being defined as admin-only elsewhere.

## Recommendation

Enforce admin membership server-side for restaurant settings routes, based on the selected restaurant from trusted server state/cookie, and requireAdminMembership in table/zone mutation APIs. Keep client-side hiding as defense in depth only.

## Revalidation

**Verdict:** true-positive

The layout still only calls `supabase.auth.getUser()` and redirects unauthenticated users; it does not check the active restaurant membership role before rendering `RestaurantSettingsPageShell`. The parent app/proxy proves the user has some ops membership, but not that the active membership is owner or manager. A host/server can therefore direct-load the settings route and render the settings shell and child settings client. The high-impact mutation part of the original report has been patched because table and zone mutation APIs now require owner/manager and CSRF. The remaining exploitable behavior is unauthorized route/UI exposure rather than confirmed capacity mutation. That makes the finding real as an authorization-gap bug, but the current severity should be much lower than HIGH.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-20)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

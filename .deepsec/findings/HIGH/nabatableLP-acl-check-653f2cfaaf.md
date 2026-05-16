# [HIGH] Restaurant settings route lacks an admin role guard

**File:** [`src/app/app/(app)/settings/restaurant/layout.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/settings/restaurant/layout.tsx#L10-L24>) (lines 10, 20, 24)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

RestaurantSettingsLayout only verifies that a Supabase user exists, then renders the restaurant settings shell for any authenticated ops user. The child settings client selects any active membership and renders sensitive settings views, including table and zone management. Tracing those paths shows TableInventoryClient exposes create/update table and zone mutations, while the backing table/zone APIs check only for a membership row and do not require owner/manager admin membership. A host/server member can therefore access /app/settings/restaurant/tables and modify capacity-affecting table or zone configuration despite canManageSettings being defined as admin-only elsewhere.

## Recommendation

Enforce admin membership server-side for restaurant settings routes, based on the selected restaurant from trusted server state/cookie, and requireAdminMembership in table/zone mutation APIs. Keep client-side hiding as defense in depth only.

## Revalidation

**Verdict:** fixed

`RestaurantSettingsLayout` now resolves the trusted active restaurant from the server-validated ops active restaurant cookie plus the authenticated user's memberships, then requires `requireAdminMembership` before rendering the settings shell. If the user is unauthenticated, lacks restaurant access, or the active restaurant membership is not owner/manager, the layout redirects before the settings children render. Table and zone mutation APIs already enforce admin roles with `isRestaurantAdminRole`, while the table inventory GET now separately enforces membership for read access.

Evidence: `pnpm exec vitest run tests/server/restaurant-settings-layout-security.test.tsx` passed on 2026-05-16. The regression coverage verifies unauthenticated users are redirected before membership checks, active non-admin members are redirected from settings, and settings render only after active restaurant admin membership passes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-20)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

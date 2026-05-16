# [HIGH] Global booking occasions can be mutated without backend role authorization

**File:** [`src/components/features/restaurant-settings/AvailabilityOccasionsEditor.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/AvailabilityOccasionsEditor.tsx#L153-L360) (lines 153, 170, 206, 360)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The editor supports creating, updating, toggling, and deleting booking occasions. Tracing the parent save path shows these changes go to `/api/ops/occasions`; those route handlers only check for a Supabase user and then use the service-role client against the global `booking_occasions` table. They do not enforce `requireMembershipForRestaurant`, `requireAdminMembership`, or a platform-admin guard. Any authenticated user, or any ops member through the proxy guard, can modify global occasion labels/availability or deactivate built-in lunch/dinner, affecting all restaurants.

## Recommendation

Add route-handler authorization to the occasions APIs, ideally a platform-admin or explicit owner/manager policy for a scoped restaurant model. Do not rely on Next proxy auth, and prevent unsafe builtin updates server-side.

## Revalidation

**Verdict:** fixed

The editor still exposes create, update, toggle, and delete UI states, but it does not directly call the API. Tracing its parent save flow reaches the occasion service and then the /api/ops/occasions route family. The current POST handler in src/app/api/ops/occasions/route.ts requires withPlatformAdminAuthorization with CSRF before inserting or upserting booking_occasions. The current PATCH and DELETE handlers in src/app/api/ops/occasions/[key]/route.ts apply the same platform-admin authorization before updating, soft-deleting, or auditing rows. DELETE also blocks builtin occasion deletion and checks references before soft-delete. This removes the exploit scenario where any ops member could rename, disable, or delete global lunch/dinner metadata.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-08)

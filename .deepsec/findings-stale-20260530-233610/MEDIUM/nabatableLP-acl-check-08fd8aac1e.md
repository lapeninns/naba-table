# [MEDIUM] Restaurant profile details are exposed to non-admin restaurant members

**File:** [`src/app/api/ops/restaurants/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/restaurants/[id]/route.ts#L76-L139) (lines 76, 129, 134, 139)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The GET handler authenticates the user and checks only general restaurant membership via requireMembershipForRestaurant, while PATCH requires requireAdminMembership and DELETE requires owner membership. The same response includes admin/settings fields such as managerNotificationPhone, managerDailySummaryEnabled, reminder preferences, and reservation lifecycle settings. A lower-privileged member of the restaurant, such as host/server, can call this API directly and read settings data that the restaurant settings UI gates behind admin membership.

## Recommendation

Either require admin membership for this GET handler or return a role-aware redacted DTO for non-admin members that excludes manager alert contact details and admin-only settings.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

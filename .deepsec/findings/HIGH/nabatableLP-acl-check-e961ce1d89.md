# [HIGH] Occasion catalog mutations lack backend role authorization

**File:** [`src/components/features/restaurant-settings/AvailabilityOccasionsEditor.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/AvailabilityOccasionsEditor.tsx#L153-L206) (lines 153, 171, 206)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The editor exposes create, update, and delete paths for booking occasions at lines 153, 171, and 206. Tracing the save path shows these call /api/ops/occasions and /api/ops/occasions/[key], whose handlers only require a Supabase user and then use the service-role client to mutate the global booking_occasions catalog. They do not call requireAdminMembership or any equivalent role-aware backend authorization. Because these occasions are global catalog data used by the booking flow, a low-privileged authenticated ops user with any membership can rename, disable, or delete occasion options affecting other restaurants.

## Recommendation

Enforce authorization in the route handlers before any service-role write. Either restrict global occasion management to a true platform/admin permission, or scope occasions by restaurant_id and require requireAdminMembership/requireMembershipForRestaurant for that restaurant. Do not rely on Next.js proxy middleware as the only guard.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

# [HIGH] Restaurant availability page can mutate the global booking occasion catalog

**File:** [`src/components/features/restaurant-settings/AvailabilityScheduleManager.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/AvailabilityScheduleManager.tsx#L86-L521) (lines 86, 91, 210, 483, 507, 521)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The manager loads and mutates occasions through the global occasion service rather than a restaurant-scoped API: it calls useOpsOccasions/useOccasionService and then createOccasion, updateOccasion, and deleteOccasion from the per-restaurant availability workflow. Tracing those imports shows they call /api/ops/occasions and /api/ops/occasions/[key], whose handlers only check that a Supabase user exists before using the service-role client to write booking_occasions. The booking_occasions table is global and has no restaurant_id, so a user with any ops access can directly change labels, active status, default durations, availability rules, or delete non-builtin occasions used by other tenants. Next.js proxy requireOpsAuth only proves some membership and is not a sufficient route-level authorization control.

## Recommendation

Do not expose global booking occasion mutations from restaurant settings. Either make occasions restaurant-scoped and require requireAdminMembership for the target restaurant on every mutation, or restrict /api/ops/occasions writes to a true platform-admin role enforced inside the route handler. Keep the UI aligned with that authorization boundary and prevent restaurant admins/staff from editing global catalog rows.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

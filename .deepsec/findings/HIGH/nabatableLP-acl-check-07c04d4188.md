# [HIGH] Global occasion mutations lack backend role authorization

**File:** [`src/components/features/restaurant-settings/OccasionsSection.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/OccasionsSection.tsx#L70-L131) (lines 70, 73, 93, 96, 115, 116, 125, 131)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This component's create/update/delete/toggle paths call the occasion service for `/api/ops/occasions` mutations. Tracing those handlers shows they only call `supabase.auth.getUser()` and then use the service-role Supabase client to write `booking_occasions`; they do not call `requireAdminMembership`, `requireMembershipForRestaurant`, or any platform-admin check. As a result, any authenticated user who can reach the handler, and at minimum any low-privileged ops member passing the proxy guard, can create, edit, disable, or delete global booking occasions affecting all restaurants. Next.js proxy middleware is not a sufficient mitigation under the repo contract, and it only proves some membership, not an admin role.

## Recommendation

Add an explicit backend authorization check to `src/app/api/ops/occasions/route.ts` and `src/app/api/ops/occasions/[key]/route.ts` before service-role writes. Require an appropriate admin/platform role, and keep the UI hidden or disabled for users without that permission.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

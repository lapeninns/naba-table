# [MEDIUM] Non-admin restaurant members can create seating zones

**File:** [`src/app/api/ops/zones/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/zones/route.ts#L113-L128) (lines 113, 120, 128)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

POST only verifies that the user has some membership for the restaurant, then creates a zone. The membership role is selected but never checked, while the ops permission model defines canManageSettings as owner/manager-only and nearby settings routes use requireAdminMembership. A host/server can therefore mutate restaurant table-layout settings by calling this API directly.

## Recommendation

Replace the manual membership query on mutating zone endpoints with requireAdminMembership, or explicitly enforce RESTAURANT_ADMIN_ROLES before createZone.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-27)

**Verdict:** fixed

`src/app/api/ops/zones/route.ts` now enforces admin-only roles on `POST` before calling `createZone`, returning `403` for non-admin restaurant members. CSRF protection remains wrapped around the mutation.

Validation: `pnpm exec vitest run tests/server/restaurant-google-business-v1-routes.test.ts tests/cloudflare/booking-short-links-storage.test.ts tests/server/team-access-cache.test.ts tests/server/ops-restaurants-route-security.test.ts tests/server/tenant-authorization-sprint2.test.ts`

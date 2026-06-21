# [MEDIUM] Occasion admin listing lacks backend role authorization

**File:** [`src/app/api/ops/occasions/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/occasions/route.ts#L8-L38) (lines 8, 13, 24, 29, 37, 38)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

GET only verifies that a Supabase user exists, then uses the service-role occasion helper to return all admin occasion records. It does not enforce restaurant membership, restaurant admin role, or platform-admin authorization in the handler. The sibling POST handler requires withPlatformAdminAuthorization, and PATCH/DELETE on the keyed route do the same, so the read path is weaker than the rest of the admin surface. A valid non-admin Supabase session that reaches this handler directly can read global occasion metadata including createdBy/updatedBy user IDs and inactive/admin fields.

## Recommendation

Apply an explicit backend authorization guard to GET. Use withPlatformAdminAuthorization if this is platform-wide configuration, or expose a separate membership-checked endpoint that returns only non-sensitive public occasion fields for restaurant admins.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-23)

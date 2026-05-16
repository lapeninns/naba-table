# [HIGH] Any authenticated ops user can mutate global occasions

**File:** [`src/services/ops/occasions.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/occasions.ts#L53-L71) (lines 53, 62, 71)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

createOccasion(), updateOccasion(), and deleteOccasion() call global /api/ops/occasions endpoints. The corresponding route handlers only check that a Supabase user exists, then use getServiceSupabaseClient() to insert, update, soft-delete, and audit booking_occasions. They do not call requireMembershipForRestaurant(), requireAdminMembership(), or any platform-admin guard. A low-privilege host/server from any restaurant can alter the global occasion catalog used by restaurant availability and bookings.

## Recommendation

Require an explicit admin authorization boundary before mutations, such as requireAdminMembership() for the active restaurant or a platform-admin guard if occasions are truly global. Also enforce CSRF validation on these unsafe methods.

## Revalidation

**Verdict:** fixed

The current code does not allow any authenticated ops user to mutate global occasions. createOccasion, updateOccasion, and deleteOccasion still call the same global endpoints, but those endpoints now require withPlatformAdminAuthorization(request, { csrf: true }) before service-role writes. That guard requires both a valid session and explicit platform-admin membership through configured PLATFORM_ADMIN_USER_IDS or PLATFORM_ADMIN_EMAILS. It also enforces validateCsrfProtectedMutation for POST, PATCH, and DELETE, so a session-only request is insufficient. The actual booking_occasions insert/update/soft-delete still uses getServiceSupabaseClient, but only after the platform-admin/CSRF gate succeeds. Low-privilege hosts, servers, or viewers from any restaurant should now receive a platform-admin required/forbidden response. This was patched in the 020a7389 security sprint. The finding is no longer exploitable in the current tree.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-02)

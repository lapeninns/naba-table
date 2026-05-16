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

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

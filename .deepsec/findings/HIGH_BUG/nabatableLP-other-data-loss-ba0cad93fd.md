# [HIGH_BUG] Invitation revoke route hard-deletes invite records

**File:** [`src/app/api/ops/team/invitations/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/team/invitations/[id]/route.ts#L54-L92) (lines 54, 56, 57, 82, 85, 92)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-data-loss`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The DELETE handler reads the invitation only to get restaurant_id for the admin check, then deletes by id. It does not require status='pending', does not include restaurant_id in the delete predicate, and does not use the existing revokeRestaurantInvite helper that preserves the row by setting status='revoked' and revoked_at. A direct DELETE can remove accepted/revoked/expired invitation history, and a race where an invite is accepted after the permission read but before the delete still deletes the accepted audit row. The response also returns {success:true}, while the browser service expects {invite}, so successful revokes surface as client errors and query invalidation does not run.

## Recommendation

Replace the hard delete with an atomic status update scoped by id, restaurant_id, and status='pending', preferably by calling revokeRestaurantInvite, and return the serialized revoked invite in the response.

## Revalidation

**Verdict:** fixed

The DELETE handler calls `revokeRestaurantInvite` after the admin membership check instead of hard-deleting the row. The helper updates by `id`, `restaurant_id`, and `status='pending'`, sets `revoked_at`, returns the revoked invite, and reports already-processed invites without deleting history. Focused evidence: `tests/server/team-invitations-security.test.ts` verifies the route returns `{ invite }`, does not call delete, and applies the scoped pending-status update; targeted ESLint, Prettier, and `pnpm run typecheck` passed on 2026-05-16.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

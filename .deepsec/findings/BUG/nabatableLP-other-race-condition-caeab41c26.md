# [BUG] Profile update idempotency is checked and recorded outside the mutation

**File:** [`src/app/api/profile/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/profile/route.ts#L150-L207) (lines 150, 182, 199, 207)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

PUT first looks up an idempotency record, then updates the profile, and only after that inserts the profile_update_requests row. Two concurrent requests with the same Idempotency-Key can both pass the lookup before either insert occurs. If their payloads differ, both profile updates can be applied before the key conflict is detected, and insert errors are only logged, so a failed idempotency write still returns success. This can cause lost profile updates and inconsistent retry behavior for the authenticated user's own profile.

## Recommendation

Move the idempotency claim and profile update into a single database transaction/RPC. Enforce a unique constraint on (profile_id, idempotency_key), insert or lock the idempotency row before applying the update, and treat conflicting payload hashes as a hard 409 before mutation.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)

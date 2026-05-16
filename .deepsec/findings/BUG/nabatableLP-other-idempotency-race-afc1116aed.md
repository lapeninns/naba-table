# [BUG] Profile update idempotency is not atomic

**File:** [`src/app/api/profile/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/profile/route.ts#L150-L208) (lines 150, 151, 152, 153, 154, 162, 175, 182, 183, 184, 185, 199, 200, 201, 202, 203, 207, 208)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-idempotency-race`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PUT checks profile_update_requests for the key, updates the profile, and only then inserts the idempotency record. Concurrent requests with the same Idempotency-Key can both pass the lookup and apply different payloads; if the later idempotency insert fails, the error is only logged and the already-applied update is still returned as success. This defeats the conflict handling and can produce last-write-wins profile corruption for retried or duplicated client requests.

## Recommendation

Move the idempotency check and profile update into a single database transaction/RPC. Reserve the (profile_id, idempotency_key) before applying the update, enforce a unique constraint, return 409 on payload hash mismatch, and treat persistence failures as request failures instead of logging and continuing.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)

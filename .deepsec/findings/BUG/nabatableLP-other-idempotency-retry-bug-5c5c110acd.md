# [BUG] Ops booking retry can lose idempotency and create duplicates

**File:** [`reserve/features/reservations/wizard/api/useCreateOpsReservation.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/reserve/features/reservations/wizard/api/useCreateOpsReservation.ts#L59-L95) (lines 59, 64, 94, 95)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-idempotency-retry-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The hook creates an Idempotency-Key for the ops booking POST and stores it in idempotencyKeyRef, but on any mutation error it clears the ref. If the server successfully creates the booking but the client sees an ambiguous failure such as a lost response or transient network error, a staff retry generates a new key. The traced /api/ops/bookings handler deduplicates ops creates by the submitted Idempotency-Key, so changing the key defeats dedupe and can create a duplicate walk-in booking and duplicate side effects.

## Recommendation

Preserve the idempotency key across retryable or ambiguous failures and clear it only after a confirmed success or a clearly terminal validation/auth error. Consider matching the public hook's timeout handling and adding a server-side duplicate fallback based on the booking signature for ops creates.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-01)

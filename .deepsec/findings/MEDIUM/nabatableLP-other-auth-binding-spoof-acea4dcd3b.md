# [MEDIUM] Generic actor id is written as booking owner auth_user_id

**File:** [`server/booking/BookingValidationService.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/booking/BookingValidationService.ts#L168-L225) (lines 168, 225)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-auth-binding-spoof`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The validator copies ctx.actorId into the booking commit payload as authUserId on create and update. This conflates an audit/request actor with the authenticated customer owner. In the public /api/bookings unified-validation path, ctx.actorId is the clientRequestId, which is derived from a caller-controlled UUID Idempotency-Key when present; the capacity RPC then writes p_auth_user_id into bookings.auth_user_id. Endpoints such as reservation confirmation and dashboard update paths use bookings.auth_user_id as an ownership signal, so an unauthenticated client can bind a newly created booking to an arbitrary known user UUID, or to their own user id while using someone else's contact details. The update path has the same unsafe assignment pattern and can also risk ownership corruption if staff actor ids are persisted as booking auth_user_id.

## Recommendation

Separate audit actor/request ids from resource ownership. Add a distinct authenticatedCustomerUserId/authUserId field that is set only from a verified Supabase session, pass null for unauthenticated public bookings, and preserve the existing booking auth_user_id during staff updates unless there is an explicit verified account-linking flow.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-02)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-20)

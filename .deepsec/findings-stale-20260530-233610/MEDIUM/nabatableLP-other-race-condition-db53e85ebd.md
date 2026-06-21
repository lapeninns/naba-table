# [MEDIUM] One-time confirmation tokens are consumed non-atomically

**File:** [`src/app/api/bookings/confirm/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/bookings/confirm/route.ts#L82-L85) (lines 82, 85)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route validates the token at line 82 and only marks it used at line 85. The traced markTokenUsed helper performs a separate update by confirmation_token without filtering confirmation_token_used_at IS NULL or checking that exactly one unused row was updated. Two concurrent requests with the same token can both pass validation before either update is visible, and both receive the booking confirmation payload, undermining the one-time replay protection.

## Recommendation

Consume the token atomically, preferably with a database RPC/transaction or single UPDATE ... WHERE confirmation_token = ? AND confirmation_token_used_at IS NULL AND confirmation_token_expires_at > now() RETURNING ... flow. Return booking details only from the successful atomic consume path and reject when no row was updated.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-24)

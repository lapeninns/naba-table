# [HIGH_BUG] Confirmation route rejects generated confirmation tokens

**File:** [`src/app/api/bookings/confirm/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/bookings/confirm/route.ts#L16-L68) (lines 16, 68)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-token-length-mismatch`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The route requires tokens to be exactly 64 characters before it calls validateConfirmationToken(). The actual generator in server/bookings/confirmation-token.ts uses randomBytes(32).toString('base64url'), which produces 43-character tokens, and that generator is used when bookings are created and when the sr_confirm cookie is set. As a result, valid generated confirmation tokens from query string or cookie are rejected as INVALID_TOKEN at this route before any database validation, breaking the guest confirmation flow.

## Recommendation

Centralize the confirmation token format and make this schema match the generator, for example by accepting the 43-character base64url format, or change the generator/storage/tests to consistently produce 64-character tokens.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-24)

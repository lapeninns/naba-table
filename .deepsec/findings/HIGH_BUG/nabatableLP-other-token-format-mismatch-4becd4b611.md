# [HIGH_BUG] Generated confirmation tokens are rejected by the confirm API

**File:** [`server/bookings/confirmation-token.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings/confirmation-token.ts#L9-L12) (lines 9, 11, 12)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-token-format-mismatch`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

generateConfirmationToken() uses randomBytes(32).toString('base64url'), which produces a 43-character token, while the public confirm route validates tokens as exactly 64 characters before calling validateConfirmationToken(). Tokens created by this helper and stored on bookings will therefore be rejected as INVALID_TOKEN, breaking the guest confirmation flow. The JSDoc also incorrectly states that the generated token is 64 characters.

## Recommendation

Make token generation and validation use the same format. Either accept the 43-character base64url output with an exact regex/length check, or generate 64-character hex tokens with randomBytes(32).toString('hex'). Add a route-level regression test using the real generator.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-23)

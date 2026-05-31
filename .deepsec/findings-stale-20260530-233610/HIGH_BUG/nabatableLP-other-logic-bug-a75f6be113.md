# [HIGH_BUG] Confirmation endpoint rejects application-generated tokens

**File:** [`src/app/api/bookings/confirm/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/bookings/confirm/route.ts#L16-L68) (lines 16, 64, 68)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The route only accepts confirmation tokens that are exactly 64 characters via `z.string().min(64).max(64)`. The imported token generator uses `randomBytes(32).toString('base64url')`, which produces 43-character tokens, and booking creation stores that generated value. Newly created bookings therefore receive confirmation tokens that fail validation and return `INVALID_TOKEN` before any database lookup, breaking the guest confirmation flow.

## Recommendation

Align validation with generation, for example by accepting 43-character base64url tokens, or change generation to 48 random bytes for 64-character tokens while preserving compatibility for existing tokens. Add a test that creates a generated token and verifies this endpoint accepts it.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-24)

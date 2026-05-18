# [MEDIUM] Restaurant logo upload does not validate CSRF tokens

**File:** [`src/app/api/ops/restaurants/[id]/logo/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/logo/route.ts#L68-L141) (lines 68, 70, 90, 107, 141)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The POST handler uses cookie-bound auth, verifies admin membership, parses multipart form data, and writes to Supabase Storage, but it never validates the CSRF token that the frontend fetch helper sends. A same-site attacker/browser context that can issue credentialed multipart requests could force storage writes under a victim admin's restaurant.

## Recommendation

Reject mutating requests unless validateCsrfToken(req) succeeds before reading formData or uploading.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-27)

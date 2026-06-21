# [BUG] Lead insert failures are ignored

**File:** [`src/app/api/lead/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/lead/route.ts#L36-L38) (lines 36, 38)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-silent-db-error`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

supabase.from("leads").insert(...) returns an error object on database or RLS failures, but the handler does not inspect it and always returns success unless the promise itself throws. This can silently drop lead submissions and mislead the frontend/operator.

## Recommendation

Destructure { error } from the insert result, log server-side details, and return a non-2xx response when the insert fails.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)

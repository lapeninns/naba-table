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

## Revalidation

**Verdict:** fixed

`src/app/api/lead/route.ts` now checks the resolved Supabase insert `{ error }` value. Insert errors are logged server-side and return `500` with a stable `Unable to store lead` payload instead of reporting success. `tests/server/lead-route.test.ts` covers the successful insert path, resolved Supabase insert errors, and the rate-limit short-circuit.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)

# [MEDIUM] Authenticated users can create unlimited public avatar objects

**File:** [`src/app/api/profile/image/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/profile/image/route.ts#L51-L105) (lines 51, 64, 88, 96, 100, 105)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-resource-exhaustion`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

Any signed-in user can upload a 2 MB file to a public Supabase storage bucket through the service-role client. The path includes a timestamp and random UUID, so repeated uploads create new objects rather than replacing the old avatar, and there is no rate limit, per-user quota, or cleanup of previous uploads. This enables storage/cost abuse by any authenticated account.

## Recommendation

Add per-user rate limiting and storage quotas, overwrite or delete the user's previous avatar object, and validate/rasterize uploaded images before storing them in a public bucket.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)

# [MEDIUM] Zone mutation endpoints do not validate CSRF tokens

**File:** [`src/app/api/ops/zones/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/zones/[id]/route.ts#L23-L147) (lines 23, 35, 85, 108, 120, 147)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Both PATCH and DELETE use cookie-bound Supabase auth and then mutate zone records, but neither validates the CSRF token. The app creates/sends CSRF tokens elsewhere, but this handler ignores them, allowing same-site credentialed request forgery to update or delete zones.

## Recommendation

Call validateCsrfToken(req) at the start of PATCH and DELETE before parsing route params or performing database mutations.

## Revalidation

**Verdict:** fixed

Both exported mutation handlers are now wrapped with withCsrfProtectedMutation. That wrapper calls validateCsrfProtectedMutation, requires an unsafe HTTP method, and compares the CSRF header against the CSRF cookie with timingSafeEqual. If either token is missing or mismatched, it returns a 403 before the route parses params, authenticates the Supabase session, or mutates zone data. This is applied to both PATCH and DELETE in the current src/app/api/ops/zones/[id]/route.ts file. The same-site credentialed request forgery described by the finding is blocked by the current handler.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-27)

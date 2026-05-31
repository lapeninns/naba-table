# [MEDIUM] Malformed table ids can expose raw backend errors

**File:** [`src/app/api/ops/tables/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/tables/[id]/route.ts#L101-L400) (lines 101, 102, 316, 342, 343, 400)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PATCH and DELETE use the dynamic route parameter directly in Supabase lookups before validating that it is a UUID. If an authenticated caller supplies a malformed id, the Supabase/Postgres error from fetchTableById can be thrown and the outer catch returns error.message to the client. This can expose internal driver/schema details instead of a stable 400 response.

## Recommendation

Validate context.params.id with a UUID schema before any Supabase call and return a generic 400/404 error. Keep raw database errors in server logs only.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

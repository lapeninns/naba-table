# [MEDIUM] Restaurant creation returns raw internal error messages

**File:** [`src/app/api/ops/restaurants/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/route.ts#L220-L223) (lines 220, 222, 223)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST catch block returns error.message directly to the client. The createRestaurant helper wraps Supabase insert and membership failures with the original database error message, so crafted failures can expose constraint names, schema details, or provider error text to authenticated callers.

## Recommendation

Log detailed errors server-side, but return a generic client message. Map expected cases such as duplicate slug or invalid input to controlled 4xx responses without exposing raw database messages.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)

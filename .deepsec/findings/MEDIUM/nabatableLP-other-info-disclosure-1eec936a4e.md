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

## Revalidation

**Verdict:** true-positive

The catch block still computes const message = error instanceof Error ? error.message : 'Unable to create restaurant' and returns that message to the caller. createRestaurant wraps Supabase insert failures as Failed to create restaurant: ${restaurantError.message} and membership failures as Failed to create restaurant membership: ${membershipError.message}. Those messages can include database/provider details such as constraint names, type errors, or schema information. The route also calls upsertRestaurantBusinessDescription after creation, and unexpected thrown Error messages would be exposed in the same way. Expected validation failures are handled separately as controlled 400 responses, but write-path failures are not mapped to safe client messages. This remains a valid information-disclosure issue for authenticated callers.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)

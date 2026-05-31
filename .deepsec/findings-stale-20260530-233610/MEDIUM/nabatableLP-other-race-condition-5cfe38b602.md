# [MEDIUM] Non-atomic onboarding check allows multiple restaurant creation

**File:** [`src/app/api/onboarding/restaurant/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/onboarding/restaurant/route.ts#L43-L78) (lines 43, 51, 78)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler checks whether the authenticated user already has any restaurant membership, then separately calls the service-role createRestaurant flow. That invariant is not enforced atomically with creation. Two concurrent POST requests from the same new account can both observe no memberships and both create a restaurant plus owner membership before either request sees the other's insert. The 5/minute rate limit limits volume but does not prevent a two-request race, allowing bypass of the route's one-onboarding-restaurant-per-account rule.

## Recommendation

Move the no-existing-restaurant invariant into the transactional create_restaurant_with_owner RPC, or protect the onboarding create path with a per-user advisory lock/unique onboarding claim so the check and insert are atomic.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)

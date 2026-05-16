# [BUG] Access grant script accepts obsolete restaurant roles

**File:** [`scripts/grant-restaurant-access.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/grant-restaurant-access.ts#L27-L174) (lines 27, 53, 160, 174)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-role-model-drift`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script only allows `owner`, `admin`, `staff`, and `viewer`, but the current role model is `owner`, `manager`, `host`, and `server`. As a result it rejects valid roles like `manager`, while allowing `admin`, `staff`, or `viewer` rows to be inserted or updated in `restaurant_memberships`. Those invalid rows can create broken authorization behavior because current guards compare memberships against the canonical role set.

## Recommendation

Import and reuse `RESTAURANT_ROLE_OPTIONS` or `isRestaurantRole` from `lib/owner/auth/roles.ts` instead of maintaining a local allow-list.

## Revalidation

**Verdict:** fixed

`scripts/grant-restaurant-access.ts` now uses the canonical `isRestaurantRole` and `RESTAURANT_ROLE_OPTIONS` helpers from `lib/owner/auth/roles.ts`, so it accepts only `owner`, `manager`, `host`, and `server`. The script also fails if an existing membership has a non-canonical role before attempting to update it.

Evidence: `pnpm exec vitest run tests/scripts/grant-restaurant-access-roles.test.ts` passed on 2026-05-16. `pnpm exec prettier --check scripts/grant-restaurant-access.ts tests/scripts/grant-restaurant-access-roles.test.ts` also passed.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

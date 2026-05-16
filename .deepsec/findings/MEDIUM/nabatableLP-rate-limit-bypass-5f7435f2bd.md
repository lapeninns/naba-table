# [MEDIUM] Restaurant creation is unthrottled

**File:** [`src/app/api/ops/restaurants/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/route.ts#L114-L181) (lines 114, 141, 150, 153, 181)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST creates restaurants, owner memberships, and optional business descriptions without consumeRateLimit or any per-user creation quota. An authenticated user who can reach this route can automate restaurant creation and pollute tenant data or consume database resources.

## Recommendation

Add a backend rate limit keyed by user id and IP, and enforce a product-level quota or onboarding state check for restaurant creation. Return 429 with rate-limit headers when exceeded.

## Revalidation

**Verdict:** true-positive

The POST handler has no consumeRateLimit or requireApiRateLimit call. The proxy only performs ops authentication and does not provide a creation quota or per-user/per-IP limiter for this endpoint. After basic schema validation, createRestaurant inserts a restaurant and an owner membership using the service-role client. An authenticated ops user can automate POST requests with different names/slugs and create many active tenant records until database or application limits are hit. I did not find a product-level quota or onboarding-state check in this route. The finding is therefore still real, with the expected impact being tenant/resource spam rather than direct cross-tenant data access.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)

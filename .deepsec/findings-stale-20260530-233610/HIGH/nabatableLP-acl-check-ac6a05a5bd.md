# [HIGH] Ops restaurant creation lacks route-local authorization

**File:** [`src/app/api/ops/restaurants/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/route.ts#L114-L176) (lines 114, 130, 141, 150, 153, 176)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST /api/ops/restaurants only verifies that a Supabase user exists, then uses the service-role client to create a restaurant and passes user.id to createRestaurant, which creates an owner membership for the new restaurant. The handler does not call requireOpsAuth, requireMembershipForRestaurant, requireAdminMembership, validateCsrfToken, or consumeRateLimit. The proxy middleware's requireOpsAuth is not a sufficient backend authorization control for the route itself. A low-privileged or otherwise merely authenticated account that reaches this handler can create active restaurants and become owner, bypassing intended ops/onboarding controls and enabling tenant/resource spam.

## Recommendation

Add an explicit route-handler authorization decision before parsing/mutating: either remove this ops POST and force creation through the CSRF-protected onboarding endpoint, or require an appropriate server-side role/platform permission. Add CSRF validation and per-user/IP rate limiting for restaurant creation.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)

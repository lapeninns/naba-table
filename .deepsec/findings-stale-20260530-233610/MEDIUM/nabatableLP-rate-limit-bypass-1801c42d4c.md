# [MEDIUM] Unrate-limited FoodMenus projection can write persistent snapshots

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/projection/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/projection/route.ts#L47-L57) (lines 47, 50, 57)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route performs backend auth, CSRF, and restaurant-admin authorization, but after that it directly calls prepareFoodMenusProjection with a service-role client. The request-controlled foodMenusName is forwarded, and persist is forwarded as optional; in the service layer, omitted persist defaults to true, so ordinary projection requests can create persistent projection snapshots and projected identity rows. Because this route has no requireApiRateLimit or provider refresh budget, a compromised or abusive restaurant manager can repeatedly POST unique foodMenusName values to avoid snapshot hash dedupe and grow GBP FoodMenus snapshot/audit storage for the tenant. The existing auth and tenant checks prevent cross-tenant access, but they do not mitigate authenticated write amplification.

## Recommendation

Add a tenant/user/IP-scoped rate limit before the service call, cap and validate foodMenusName or derive it server-side from the linked GBP context, and consider making preview projections non-persistent by default unless persistence is explicitly required.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)

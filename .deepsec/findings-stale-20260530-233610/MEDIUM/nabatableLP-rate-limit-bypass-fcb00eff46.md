# [MEDIUM] Rate limit runs in parallel with the expensive service-role load

**File:** [`src/app/api/ops/bookings/[id]/assignment-context/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/bookings/[id]/assignment-context/route.ts#L33-L51) (lines 33, 45, 47, 51)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

After booking authorization succeeds, the route starts requireApiRateLimit and loadAssignmentContextPayload in the same Promise.all, then checks the rate-limit response only after both promises complete. As a result, requests that should be rejected with 429 still execute the service-role assignment-context loader, including booking, table, assignment, and conflict queries for the tenant. The auth and tenant predicates are present, but an authenticated restaurant member can still generate backend load past the configured limit because the limiter does not gate the expensive work.

## Recommendation

Await requireApiRateLimit immediately after authorization and return the 429 before creating service-role clients or calling loadAssignmentContextPayload. Keep the tenant/user scoped limiter, but make it a real gate around the expensive loader.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-06)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-03)

# [MEDIUM] Unauthenticated endpoint exposes seating merge policy

**File:** [`src/app/api/config/merge-rules/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/config/merge-rules/route.ts#L5-L19) (lines 5, 7, 9, 10, 19)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `public-endpoint`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

GET performs no backend session, role, or membership check before querying merge_rules and returning every rule's id, capacity mapping, enabled flag, same-zone requirement, adjacency requirement, and cross-category merge flag. This route is not under /api/ops, so the proxy's ops auth guard does not apply; non-ops /api routes pass through directly. An external caller can request this endpoint to learn internal capacity-planning and table-merge behavior.

## Recommendation

Move this behind an ops-authenticated route or add an explicit backend authorization check before querying. If these rules are intentionally public, document that contract and return only the minimum fields required by the guest flow.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)

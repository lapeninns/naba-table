# [BUG] Service-role policy verification can misclassify drifted schemas

**File:** [`scripts/verify-gbp-foodmenus-storage.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/verify-gbp-foodmenus-storage.ts#L216-L391) (lines 216, 242, 391)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-verification-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The verifier reduces the service-role policy check to a total count of policies whose roles include service_role, then requires that count to equal the number of expected FoodMenus tables. It does not require one expected policy per expected table or verify the expected policy names. A drifted schema with duplicate service-role policies on one expected table and a missing policy on another can still satisfy the count and be reported as foodmenus_storage_applied when the rest of the schema checks pass; conversely, an extra legitimate service-role policy can cause a false failure. This is an operational validation bug rather than a directly exploitable vulnerability, but this script is used as the rollout gate.

## Recommendation

Track service-role policies by table and expected policy name. Require each EXPECTED_TABLES entry to have its corresponding service_role FOR ALL policy, and report missing or extra policies separately.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

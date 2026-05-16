# [HIGH] Stored unsafe URL can become a public JavaScript link

**File:** [`src/app/api/onboarding/restaurant/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/onboarding/restaurant/route.ts#L37-L43) (lines 37, 43)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This route parses attacker-controlled restaurant creation input with the shared `createRestaurantSchema` and persists it via `createRestaurant()`. That schema accepts `googleMapUrl` with `z.string().url()`, which accepts schemes such as `javascript:` and `data:`. The stored `google_map_url` is later used directly as the public restaurant page's map link href, so a malicious restaurant can publish a link like `javascript:alert(document.domain)` that executes when a guest clicks `Open map`.

## Recommendation

Restrict stored external URLs to `https:` and expected Google Maps/Review hostnames before persistence. Reuse a central safe URL validator for create/update schemas and reject `javascript:`, `data:`, and other non-web schemes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

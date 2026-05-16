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

## Revalidation

**Verdict:** fixed

The route still accepts attacker-controlled JSON and passes it through createRestaurantSchema before calling createRestaurant, so the original data path still exists. The current shared createRestaurantSchema no longer uses a generic z.string().url() for googleMapUrl; it uses googleUrlSchema with safeGoogleMapsUrl, which requires https: and an allowed Google/Maps host. createRestaurant also sanitizes googleMapUrl and googleReviewUrl again before persistence, so bypassing the route schema would still store null for javascript: or data: values. The public restaurant page also calls safeGoogleMapsUrl before rendering the Open map href and falls back to a generated Google Maps search URL. Existing malicious stored values are therefore filtered on read/render as well as on new writes. I also verified the targeted safe-url and restaurant schema regression tests pass.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)

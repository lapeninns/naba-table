# [HIGH] Restaurant details update accepts executable public map URLs

**File:** [`server/restaurants/details.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/details.ts#L119-L272) (lines 119, 272)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

validateDetailsInput() only trims googleMapUrl and updateRestaurantDetails() forwards it into the restaurant update path. The upstream Zod .url() checks in the route are not a mitigation because they accept schemes such as javascript: and data:. The stored googleMapUrl is exposed on the public restaurant detail page and rendered as an anchor href for the Open map action, so a restaurant admin can persist a javascript: URL that executes when a guest clicks that link.

## Recommendation

Validate public URL fields in a shared server-side helper before persistence. Require http: or https:, and for googleMapUrl/googleReviewUrl preferably restrict to expected Google Maps/review hostnames. Reject javascript:, data:, file:, and other non-web schemes.

## Revalidation

**Verdict:** fixed

The current details update path no longer only trims googleMapUrl. validateDetailsInput calls safeGoogleMapsUrl and safeGoogleReviewUrl, and updateRestaurant also applies those helpers before writing google_map_url and google_review_url. The ops details route schema uses googleUrlField with the same helpers, so javascript: and data: inputs fail validation before the helper call. Even if an unsafe legacy value exists in the database, getRestaurantDetails and the public getRestaurantBySlug path return sanitized map URLs. PublicSections.getMapsHref then sanitizes again before rendering the Open map href. Git blame attributes the server-side sanitizer additions to 020a7389, so the described executable public map href path is fixed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)

# [HIGH] Restaurant update persists unsafe URL schemes used by public pages

**File:** [`server/restaurants/update.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/update.ts#L162-L164) (lines 162, 164)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

updateRestaurant() trims and stores googleMapUrl directly as google_map_url without scheme allowlisting. The API schemas use generic URL validation, which accepts javascript: and data: URLs. Public restaurant pages use the stored google_map_url as an anchor href for the map link, allowing a restaurant admin to store an executable javascript: URL and attack guests who click Open map.

## Recommendation

Normalize and validate URL fields in updateRestaurant() itself. Allow only http: and https: schemes, and restrict map/review URLs to trusted hostnames where practical.

## Revalidation

**Verdict:** fixed

The finding matches the pre-fix code path: git history for commit 020a7389 shows updateRestaurant previously trimmed input.googleMapUrl and persisted it directly to google_map_url. Current server/restaurants/update.ts no longer does that; it calls safeGoogleMapsUrl(input.googleMapUrl) before persistence and safeGoogleMapsUrl(data.google_map_url) before returning the value. The helper in lib/security/safe-url.ts parses the value as an absolute URL, requires https: for Google map URLs, rejects javascript:, data:, vbscript:, file:, and blob:, and restricts the hostname to Google/Google Maps hostnames. The main ops PATCH schema in src/app/api/ops/restaurants/schema.ts now uses googleUrlSchema with the same sanitizer instead of generic z.string().url(), so javascript:alert(1) is rejected before it reaches updateRestaurant. The alternate details PUT route also uses safeGoogleMapsUrl in its schema and updateRestaurantDetails validates the merged payload before calling updateRestaurant. On the read/render side, getRestaurantBySlug sanitizes restaurant.google_map_url and PublicSections.getMapsHref sanitizes again before using the value in the Open map anchor, falling back to a generated Google Maps search URL when unsafe. I also ran the focused regression tests, and tests/lib/security/safe-url.test.ts plus tests/server/restaurant-security-schema.test.ts both passed, including explicit javascript: and data: payload cases.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

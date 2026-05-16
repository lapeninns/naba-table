# [HIGH] Profile URL fields allow script URLs that are rendered to public users

**File:** [`src/app/api/ops/restaurants/[id]/details/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/details/route.ts#L47-L167) (lines 47, 48, 166, 167)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route accepts googleMapUrl and googleReviewUrl with z.string().url(), which allows non-HTTP schemes such as javascript: and data:. Those parsed values are passed directly into updateRestaurantDetails and stored. The public restaurant detail view later uses restaurant.googleMapUrl as an anchor href for the Open map link, so a restaurant admin or compromised admin account can persist a javascript: URL that executes when a guest or staff member clicks it. Frontend validation also uses URL parsing, so it does not mitigate this.

## Recommendation

Replace generic .url() validation with an allowlist for http: and https: URLs, and preferably restrict map/review links to expected Google domains. Normalize or reject existing unsafe schemes before rendering.

## Revalidation

**Verdict:** fixed

Current code rejects the specific payload class described in the finding before persistence. googleMapUrl is parsed through googleUrlField(safeGoogleMapsUrl), and googleReviewUrl is parsed through googleUrlField(safeGoogleReviewUrl); both helpers require https: and expected Google hosts, with review URLs also requiring review-related paths. If an attacker submits javascript:alert(document.domain), preprocessing leaves it as the original string and the refine step fails because the sanitizer returns null. The server-side storage path adds defense in depth because updateRestaurantDetails and updateRestaurant sanitize again before writing to restaurants.google_map_url/google_review_url. The public page no longer trusts the raw database value either, since getRestaurantBySlug and getMapsHref sanitize before rendering the Open map link. A compromised manager could only store an allowed HTTPS Google URL through this route now, not a script URL. Commit 020a7389 introduced safe-url validation and public read sanitization for this flow, so this is fixed in the current tree.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)

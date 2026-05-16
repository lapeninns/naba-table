# [HIGH] Restaurant update endpoint stores unsafe public link schemes

**File:** [`src/app/api/ops/restaurants/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/route.ts#L20-L235) (lines 20, 210, 234, 235)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PATCH validates with the imported updateRestaurantSchema and then stores googleMapUrl and googleReviewUrl directly. That schema uses generic URL validation, which accepts javascript: and data: schemes. The stored googleMapUrl is rendered as a public anchor href in the restaurant detail page, creating stored/interaction XSS when a guest or staff member clicks the link.

## Recommendation

Use a shared URL schema that only permits http: and https:, with stricter domain allowlists for Google Maps/review URLs where possible. Sanitize existing stored values before rendering.

## Revalidation

**Verdict:** fixed

The imported updateRestaurantSchema no longer accepts arbitrary absolute URLs for Google profile links. It preprocesses and validates googleMapUrl with safeGoogleMapsUrl and googleReviewUrl with safeGoogleReviewUrl, which allow only HTTPS Google Maps/review destinations and reject script-capable schemes. The route performs CSRF validation and admin membership authorization before constructing the service-role client and calling updateRestaurant. The lower-level updateRestaurant function repeats the sanitization before assigning google_map_url/google_review_url, so bypassing the route schema would still not store javascript:. Public rendering is also hardened because getRestaurantBySlug returns safeGoogleMapsUrl(restaurant.google_map_url) and PublicSections.getMapsHref revalidates before using href. An attacker with manager access cannot persist a javascript: map link through this endpoint in the current tree. The relevant patch is commit 020a7389, which introduced safe-url helpers and replaced the generic z.url validators for these fields.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

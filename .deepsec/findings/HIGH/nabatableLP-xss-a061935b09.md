# [HIGH] Restaurant profile update stores unsafe URL schemes used as public links

**File:** [`src/app/api/ops/restaurants/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/route.ts#L210-L235) (lines 210, 234, 235)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PATCH parses the request with updateRestaurantSchema and then persists googleMapUrl/googleReviewUrl into the restaurant profile. That imported schema uses generic z.string().url(), which accepts javascript: and data: schemes. The public restaurant detail page uses googleMapUrl directly as an anchor href for the Open map link, making this a stored XSS vector against guests who click the link.

## Recommendation

Validate these fields with a shared safe URL helper that requires http: or https:, and use a stricter host allowlist for Google Maps/review URLs. Reject or neutralize any non-web URL scheme before persistence.

## Revalidation

**Verdict:** fixed

The PATCH handler now parses googleMapUrl and googleReviewUrl through updateRestaurantSchema fields built with googleUrlSchema and the safe Google URL helpers, not generic z.string().url(). A javascript: or data: URL fails because safeGoogleMapsUrl/safeGoogleReviewUrl require https: and expected Google hosts. The mutation is also wrapped in withCsrfProtectedMutation and requires requireAdminMembership before service-role updateRestaurant is called. updateRestaurant itself sanitizes googleMapUrl and googleReviewUrl again before writing to restaurants.google_map_url and restaurants.google_review_url, and it returns sanitized values after the update. On the public side, getRestaurantBySlug and PublicSections.getMapsHref sanitize the stored map URL before rendering the Open map anchor, falling back to a safe Google Maps search URL. This means the concrete stored-interaction XSS scenario in the finding no longer works in current code. Commit 020a7389 added lib/security/safe-url.ts and replaced the old generic URL validation/surfaces with safe Google URL handling, so this is fixed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

# [HIGH] Restaurant update path persists javascript: map/review URLs

**File:** [`server/restaurants/update.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/update.ts#L162-L169) (lines 162, 164, 167, 169)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

updateRestaurant trims and stores googleMapUrl/googleReviewUrl without checking the URL scheme. The ops route schemas rely on z.string().url(), which accepts javascript: and data: URLs, and the public restaurant detail page renders googleMapUrl directly as the Open map href. This allows stored same-origin script execution when a guest clicks the public map link.

## Recommendation

Reject non-http(s) schemes before persisting URL fields, and use a shared URL schema in both route validation and server helpers. For map/review fields, consider allowlisting known Google Maps/review hosts.

## Revalidation

**Verdict:** fixed

This was a real issue in the old implementation because commit 020a7389 shows googleMapUrl and googleReviewUrl were previously persisted after only trim/empty normalization, while the route schemas used generic z.string().url(). In the current file, googleMapUrl is stored via safeGoogleMapsUrl and googleReviewUrl is stored via safeGoogleReviewUrl, so unsafe schemes become null rather than database values. safeGoogleReviewUrl is stricter than a generic URL check: it requires https:, a Google/Google Maps hostname, and a review-related path or href marker. The current ops update schema preprocesses and refines both fields through these sanitizers, rejecting noncanonical or unsafe values at the API boundary. The details route repeats the sanitizer-backed validation, and server/restaurants/details.ts sanitizes merged detail input before delegating to updateRestaurant. Legacy malicious database values are also mitigated on output because updateRestaurant, getRestaurantDetails, getRestaurantBySlug, email templates, and the public Open map href path all sanitize before exposing the value. The patch in 020a7389 also changed PublicSections.getMapsHref from returning restaurant.googleMapUrl directly to revalidating it and using safePublicHref for fallback. The focused Vitest run passed 6/6 tests covering unsafe schemes and schema rejection, so the current code no longer supports the described stored javascript:/data: URL attack.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

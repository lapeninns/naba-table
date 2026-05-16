# [MEDIUM] URL validation accepts unsafe schemes and non-Google destinations

**File:** [`components/ops/restaurants/restaurantDetailsFormModel.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/components/ops/restaurants/restaurantDetailsFormModel.ts#L313-L425) (lines 313, 314, 413, 416, 422, 425)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-unsafe-external-url`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

validateRestaurantDetails treats new URL(...) as sufficient validation for googleReviewUrl and googleMapUrl, and sanitizePayload preserves the trimmed values unchanged. WHATWG URL parsing accepts schemes such as javascript: and data:, as well as arbitrary https hosts. The server schemas traced from this form also use z.string().url(), so tampered requests can persist these values even if client validation is improved.

## Recommendation

Replace syntax-only URL checks with a shared safeGoogleUrl parser that requires https and approved Google Maps/review hostnames. Apply the same parser in the client model and API schemas, and normalize or reject unsafe stored values before use.

## Revalidation

**Verdict:** fixed

The current validateRestaurantDetails implementation rejects both unsafe schemes and direct non-Google destinations for googleMapUrl and googleReviewUrl. safeGoogleMapsUrl requires https plus an allowed Google/maps host, and safeGoogleReviewUrl additionally requires a review-looking path or g.page host. This means values such as javascript:alert(1), data:text/html,..., file://..., or https://phishing.example fail client validation. The same safe URL parser is reused in the ops restaurant API schemas, so a crafted PATCH/PUT request cannot persist those values by bypassing the React form. The restaurant service/update/read paths normalize these fields with the same helpers, and guest/public rendering uses safeGoogleMapsUrl or safePublicHref fallback behavior. The original parseability-only validation described by the finding has been replaced.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-08)

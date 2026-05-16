# [MEDIUM] Restaurant Google URLs are used as CTA hrefs without scheme validation

**File:** [`server/emails/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/emails/bookings.ts#L832-L835) (lines 832, 835)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-unsafe-url-scheme`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

resolveCtaUrlForTemplate returns venue.googleReviewUrl and venue.googleMapUrl directly for review and reminder email CTAs. The write-side schemas only use z.string().url(), which accepts schemes such as javascript:, data:, ftp:, and mailto:. renderButton HTML-escapes the href but does not validate the URL scheme, so a stored javascript: or data: URL can become a clickable CTA in sent email HTML and in the same-origin ops preview iframe.

## Recommendation

Validate and normalize these URLs before storage and again before rendering. For booking email CTAs, allow only http: and https: URLs, preferably restricted to expected Google Maps/review hosts for googleMapUrl/googleReviewUrl, and fall back to the safe manage URL when validation fails.

## Revalidation

**Verdict:** fixed

The current resolveVenueDetails sanitizes restaurant.google_map_url and restaurant.google_review_url with safeGoogleMapsUrl and safeGoogleReviewUrl before storing them in VenueDetails. resolveCtaUrlForTemplate then re-sanitizes params.venue.googleReviewUrl and params.venue.googleMapUrl before using either as a review or reminder CTA, falling back to manageUrl when validation fails. safeGoogleMapsUrl and safeGoogleReviewUrl require HTTPS and a Google maps/review host, and they reject javascript:, data:, vbscript:, file:, and blob: schemes. renderHtml also wraps the final ctaUrl in safePublicHref before passing it to renderButton, so a direct unsafe scheme supplied by another caller would be replaced with the manage URL. I checked the write-side schemas in src/app/api/ops/restaurants/schema.ts and src/app/api/ops/restaurants/[id]/details/route.ts; the Google URL fields now refine through the same safeGoogle\* helpers instead of accepting generic z.string().url() values. Tests in tests/lib/security/safe-url.test.ts cover rejection of executable schemes and evil Google-looking hosts. Commit 020a7389 added lib/security/safe-url.ts and wired those helpers into server/emails/bookings.ts.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-11)

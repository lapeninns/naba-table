# [HIGH] Stored unsafe URL can execute from the public map link

**File:** [`src/components/restaurants/PublicSections.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/restaurants/PublicSections.tsx#L67-L485) (lines 67, 68, 485)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getMapsHref returns restaurant.googleMapUrl directly and RestaurantDetailPage renders it as an href on the public 'Open map' anchor. The write-side validation traced for googleMapUrl uses z.string().url() / new URL(), which accepts non-http schemes such as javascript:. A restaurant admin or compromised staff account can store a javascript: URL and turn the public restaurant page into a click-triggered stored XSS/phishing vector.

## Recommendation

Validate and normalize googleMapUrl on write and before render with an allowlist: require https:, and preferably restrict hosts to Google Maps domains. Fall back to the encoded maps search URL when validation fails.

## Revalidation

**Verdict:** fixed

The current PublicSections.tsx no longer returns restaurant.googleMapUrl directly from getMapsHref. It calls safeGoogleMapsUrl first, and that helper parses the URL, requires https:, restricts hosts to Google/Google Maps domains, and rejects forbidden schemes such as javascript:, data:, vbscript:, file:, and blob:. If the stored value is invalid, getMapsHref falls back to a generated Google Maps search URL passed through safePublicHref. I also traced the data path through getRestaurantBySlug plus restaurant create/update/details helpers, and those paths now sanitize googleMapUrl with safeGoogleMapsUrl as well. The route schema also validates Google map URLs against the same sanitizer rather than accepting arbitrary z.string().url() schemes. The relevant hardening appears in commit 020a7389, which added safe-url handling and changed this component. A stored javascript: value would now be mapped to null/fallback and would not be rendered as an executable href.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)

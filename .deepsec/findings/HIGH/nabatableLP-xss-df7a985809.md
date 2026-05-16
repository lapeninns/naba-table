# [HIGH] Stored JavaScript URL can be rendered as the public map link

**File:** [`src/components/restaurants/PublicSections.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/restaurants/PublicSections.tsx#L66-L485) (lines 66, 68, 485)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getMapsHref returns restaurant.googleMapUrl directly and the detail page renders it as an anchor href for the public Open map link. Tracing writes shows restaurant googleMapUrl validation uses z.string().url() or new URL(), both of which accept javascript: URLs. A restaurant editor, compromised ops account, or synced profile source can persist a javascript: URL that is then served to public visitors as a clickable link.

## Recommendation

Validate and normalize googleMapUrl with an allowlist before storage and before rendering. At minimum allow only http: and https:, and preferably restrict map links to expected Google Maps hosts; otherwise fall back to the generated Google Maps search URL.

## Revalidation

**Verdict:** fixed

The reported direct rendering path is not present in the current file. RestaurantDetailPage still renders an anchor for Open map, but mapsHref is produced by getMapsHref, which now calls safeGoogleMapsUrl before returning any stored restaurant value. safeGoogleMapsUrl only returns normalized HTTPS URLs on expected Google Maps/Google hosts, so javascript: is rejected before render. Existing bad database values are also filtered by public restaurant mappers such as getRestaurantBySlug, which return safeGoogleMapsUrl(restaurant.google_map_url). Write-side create, update, and details paths now use safeGoogleMapsUrl and route schemas refine against it. This was patched in the security sprint commit 020a7389. A malicious editor or compromised staff account could submit such a value, but the current code would not preserve or render it as the public anchor href.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)

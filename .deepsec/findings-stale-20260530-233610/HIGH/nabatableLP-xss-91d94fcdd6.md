# [HIGH] Stored javascript: URL can reach public restaurant map links

**File:** [`src/app/api/restaurants/[slug]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/restaurants/[slug]/route.ts#L39) (lines 39)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The public restaurant detail response returns the stored `googleMapUrl` unchanged at line 39. That value is accepted elsewhere with `z.string().url()`, which allows schemes such as `javascript:` and `data:`. The same restaurant helper feeds the shipped public restaurant page, where `googleMapUrl` is returned unchanged by `getMapsHref()` and rendered as `<a href={mapsHref}>Open map</a>`. A restaurant admin can persist `javascript:...` as the map URL and cause script execution in the nabatable.com origin when a guest clicks the public map link. The proxy CSP only sets `base-uri`, `frame-ancestors`, `object-src`, and `form-action`, so it does not mitigate javascript: URL execution.

## Recommendation

Validate and normalize public URLs at write time and before rendering/returning them. Restrict map/review/logo URLs to `https:` and, for map links, expected Google Maps hosts or generate the maps search URL from address data. Reject or null out `javascript:`, `data:`, and other non-http(s) schemes in ops schemas, Google import paths, and public DTO construction. Add regression tests proving `javascript:alert(1)` is rejected.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-28)

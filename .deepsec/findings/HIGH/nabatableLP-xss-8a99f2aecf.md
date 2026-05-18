# [HIGH] Unsafe URL schemes can be persisted into public map links

**File:** [`server/restaurants/details.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/details.ts#L119-L273) (lines 119, 120, 249, 250, 272, 273)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Restaurant details only trim googleMapUrl/googleReviewUrl/logoUrl and pass them through to updateRestaurant. The reachable route schemas use z.string().url(), which accepts javascript: and data: URLs. The public restaurant page later uses googleMapUrl directly as an href for the Open map anchor, so a restaurant admin can store a javascript: URL that executes in the public site origin when a guest clicks it.

## Recommendation

Normalize restaurant URL fields with a shared server-side validator that only permits http: and https:, preferably https: plus expected Google Maps/review host allowlists for map/review fields. Apply the same validation in route schemas and before persisting.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)

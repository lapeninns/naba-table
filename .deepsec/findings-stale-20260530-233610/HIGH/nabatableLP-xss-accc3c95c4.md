# [HIGH] Restaurant update persists unsafe URL schemes used by public pages

**File:** [`server/restaurants/update.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/update.ts#L162-L164) (lines 162, 164)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

updateRestaurant() trims and stores googleMapUrl directly as google_map_url without scheme allowlisting. The API schemas use generic URL validation, which accepts javascript: and data: URLs. Public restaurant pages use the stored google_map_url as an anchor href for the map link, allowing a restaurant admin to store an executable javascript: URL and attack guests who click Open map.

## Recommendation

Normalize and validate URL fields in updateRestaurant() itself. Allow only http: and https: schemes, and restrict map/review URLs to trusted hostnames where practical.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

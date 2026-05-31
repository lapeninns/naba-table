# [HIGH_BUG] GBP service items are deleted when the optional upstream segment is absent

**File:** [`server/google-business-profile/business-info.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/business-info.ts#L1648-L2058) (lines 1648, 2054, 2055, 2056, 2057, 2058)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-data-loss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

buildCanonicalRows maps location.serviceItems with a nullish fallback to an empty array, and syncGoogleBusinessProfileCanonicalBusinessInfo always calls replaceProviderRows for restaurant_service_items. Because client.ts suppresses optional serviceItems fetch errors and returns a location without that property, a failed optional upstream fetch is indistinguishable from Google returning zero service items. The persistence path then deletes all existing GBP-managed service items for the restaurant.

## Recommendation

Track whether serviceItems were fetched successfully and skip restaurant_service_items replacement when the segment was unavailable. Only replace with an empty array when Google explicitly returned an empty serviceItems list.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)

# [HIGH_BUG] Optional serviceItems fetch failure is treated as an empty result

**File:** [`server/google-business-profile/client.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/client.ts#L607-L628) (lines 607, 616, 622, 627, 628)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-data-loss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getGoogleBusinessProfileLocationProfile fetches optional mask groups such as serviceItems separately and catches all errors by returning null. The returned location is then merged without any indication that serviceItems failed to load. Downstream sync code treats missing serviceItems as an empty list and replaces stored provider rows, so a transient Google/API/schema failure on this optional request can delete previously synced service items instead of preserving them.

## Recommendation

Return explicit per-segment fetch status, or make optional segment failure fail the sync. At minimum, pass a syncServiceItems flag through to persistence and only replace restaurant_service_items when the serviceItems segment was fetched successfully.

## Revalidation

**Verdict:** fixed

`getGoogleBusinessProfileLocationProfile` now returns `__nabatableOptionalFetchStatus.serviceItems` as `fetched` or `unavailable` after the optional read-mask request. `syncGoogleBusinessProfileCanonicalBusinessInfo` uses that status to pass `p_service_items: null` to the atomic replacement RPC when the optional segment was unavailable, preserving existing GBP-managed service items. Focused client and business-info tests cover failed optional fetch preservation and explicit empty-segment replacement.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

# [MEDIUM] Location discovery cache survives Google credential changes

**File:** [`server/google-business-profile/serviceAccessRuntime.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/google-business-profile/serviceAccessRuntime.ts#L113-L140) (lines 113, 114, 115, 116, 117, 118, 137, 138, 139, 140)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-stale-credential-cache`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

discoverGoogleBusinessProfileLocationsForProfile returns a cached discovery result keyed only by externalProfile.id before it refreshes or validates the current Google credential. The cache stores all available GBP locations for the previously authorized Google account for 10 minutes. If the restaurant reconnects with a different Google account, or the previous authorization is marked reauth_required, a later admin can still receive or submit stale locations from the old Google account until the TTL expires. Google account location lists can include locations unrelated to this restaurant, so this crosses the Google-account trust boundary even though the caller is a restaurant admin.

## Recommendation

Validate the current credential and connection status before serving cached locations, and invalidate this cache whenever credentials are upserted, deleted, disconnected, or marked reauth_required. Consider keying entries by a credential version such as updated_at/last_refreshed_at and forcing a fresh discovery after OAuth completion.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)

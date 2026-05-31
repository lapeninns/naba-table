# [BUG] Availability GBP draft overrides are registered without cleanup

**File:** [`src/components/features/restaurant-settings/useAvailabilityScheduleManagerController.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/components/features/restaurant-settings/useAvailabilityScheduleManagerController.ts#L45-L129) (lines 45, 105, 107, 109, 124, 126, 127, 129)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-stale-draft-overrides`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The controller derives availability draft overrides and registers each one with the GBP drift registry, but the effect never clears field keys that disappear from a later draft or on unmount. The registry supports clearing by passing null or calling clearDraftOverrides, and the profile draft hook uses cleanup for the same pattern. In this controller, a service-period override can remain in the registry after the local service window is removed, renamed, or no longer matches the previous drift field. That can leave the Google comparison workspace using stale local values, causing drift badges and import/review decisions to be hidden or shown incorrectly until the provider state is reset.

## Recommendation

Track the registered availability field keys and clear keys that are no longer present, and return an effect cleanup that removes the current availability override keys when the controller unmounts or the restaurant changes. Consider mirroring the cleanup pattern used by useProfileGbpDraftOverrides.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)

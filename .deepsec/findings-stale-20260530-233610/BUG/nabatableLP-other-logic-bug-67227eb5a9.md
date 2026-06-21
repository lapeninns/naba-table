# [BUG] Fake replay adapter reports null hashes for successful profile operations

**File:** [`server/dual-sync/replay/fake-google.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/dual-sync/replay/fake-google.ts#L277-L518) (lines 277, 280, 282, 514, 517, 518)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This is a non-security logic bug in the replay helper. fieldHash() hashes sectionValue(snapshot, config.sectionKey), so profile fields pass the entire profile object into profile canonicalizers that expect scalar field values. Those canonicalizers return null for objects, causing successful profile imports/exports to report null afterCoreHash/afterGbpHash even though the fake snapshot was mutated. This can weaken replay/publish test coverage for profile fields by hiding incorrect post-write hashes.

## Recommendation

Mirror the production valueForField behavior before canonicalizing, especially extracting the concrete profile field for config.kind === 'profile'. Add replay adapter tests asserting successful profile operations return non-null expected after hashes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)

# [BUG] Profile hydration can overwrite concurrent explicit edits

**File:** [`lib/profile/server.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/lib/profile/server.ts#L180-L234) (lines 180, 192, 193, 208, 231, 234)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

ensureProfileRow reads the existing profile, decides name or phone is missing, fetches fallback customer contact data, and then updates the profile by id only. If the user explicitly updates their profile after the initial read but before the hydration update commits, this stale hydration write can overwrite the user's newer name or phone because the UPDATE does not check that those columns are still blank.

## Recommendation

Make the hydration update atomic by adding conditions that the target fields are still null/blank, or move the read/import/write into a database function or transaction that preserves concurrent user edits.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)

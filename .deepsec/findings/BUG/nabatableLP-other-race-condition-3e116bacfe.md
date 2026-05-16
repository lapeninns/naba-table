# [BUG] Profile hydration can clobber concurrent user edits

**File:** [`lib/profile/server.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/lib/profile/server.ts#L180-L234) (lines 180, 192, 193, 218, 221, 231, 234)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The function reads the profile, decides name/phone are missing, fetches fallback contact data, then updates the profile with only an id predicate. If the user updates one of those fields between the initial read and the hydration update, the stale hydration write can overwrite the newer user-supplied value. This is a real TOCTOU data-integrity bug even without an attacker.

## Recommendation

Move hydration into an atomic database function/transaction with row locking, or add conditional predicates so each field is updated only if it is still null/empty at write time. Re-read and merge on conflict if the conditional update affects no row.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)

# [BUG] Offline queue flush can drop or resurrect actions added during an in-flight flush

**File:** [`src/contexts/booking-offline-queue.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/contexts/booking-offline-queue.tsx#L91-L98) (lines 91, 96, 97, 98)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-queue-race-condition`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

During `flushQueue`, the code snapshots `[next, ...rest]` before awaiting `next.perform()`, then overwrites `queueRef.current` and React state with that stale `rest` array after the await. If another action is enqueued or dequeued while `next.perform()` is in flight, the post-await assignment discards that concurrent change. This can lose a newly queued offline action or reintroduce an action that was removed.

## Recommendation

After a successful `perform()`, remove only the processed action from the latest queue state, for example with a functional `setPending((current) => current.filter((entry) => entry.id !== next.id))`, and update `queueRef.current` from that latest value.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)

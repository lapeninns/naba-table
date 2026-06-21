# [BUG] Targeted review backfill can drain review emails for all restaurants

**File:** [`scripts/queues/backfill-review-request-jobs.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/queues/backfill-review-request-jobs.ts#L269-L389) (lines 269, 270, 216, 217, 388, 389)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-broad-drain`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The apply path can be scoped to one restaurant via TARGET_RESTAURANT_ID, and the booking query applies that restaurant_id predicate. However, when --drain is also supplied, the script calls drainCron('review_request'), which constructs /api/cron/process-emails with only types=review_request. The cron endpoint and drainDueEmailIntents path filter by email type, not by restaurant or the jobs enqueued by this run, so a targeted backfill can also process due review-request jobs for unrelated restaurants.

## Recommendation

Either disable --drain for targeted backfills, or add a restaurant/job-id filter to the cron drain path and pass TARGET_RESTAURANT_ID or the specific dedupe keys enqueued by the script.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

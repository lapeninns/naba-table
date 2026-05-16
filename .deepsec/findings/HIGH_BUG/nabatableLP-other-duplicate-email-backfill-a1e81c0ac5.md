# [HIGH_BUG] Review backfill can requeue already-sent review emails

**File:** [`scripts/queues/backfill-review-request-jobs.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/queues/backfill-review-request-jobs.ts#L190-L232) (lines 190, 202, 225, 232)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-duplicate-email-backfill`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

When the email_delivery_log table is unavailable, the script sets deliveryLogAvailable=false and falls back to enqueuing every eligible completed booking. The comment says this relies on queue-level idempotency, but enqueueEmailJob ultimately upserts by dedupe_key, which can overwrite an existing sent/skipped/failed email_dispatch_intents row back to pending. Running this script with --apply in that fallback mode can mass re-send review_request emails to customers who already received them.

## Recommendation

Fail closed if delivery-log dedupe is unavailable, or also query email_dispatch_intents for existing review_request dedupe keys before enqueueing. Do not reset terminal intent rows with a plain upsert unless an explicit retry mode is requested.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-23)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

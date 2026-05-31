# [MEDIUM] Retry stale check is not bound to the Google push

**File:** [`server/google-business-profile/workflowPublishRetryService.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/google-business-profile/workflowPublishRetryService.ts#L70-L94) (lines 70, 74, 87, 94)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-toctou-step-up-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The retry path compares stored post-Nabatable hashes with current hashes, but then claims the job and calls pushDraftToGoogle without locking the restaurant data or passing an immutable value snapshot. Because pushDraftToGoogle refetches live restaurant state through the sync services, a local edit that lands after the hash comparison but before the Google push can be sent to Google under the old approved retry.

## Recommendation

Hold a per-restaurant publish lock across the hash check, job claim, and Google push, or make pushDraftToGoogle operate on the exact reviewed values whose hashes were checked. Recheck selected hashes immediately before the external call if locking is not available.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)

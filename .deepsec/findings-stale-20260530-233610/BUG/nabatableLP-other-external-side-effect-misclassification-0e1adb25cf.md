# [BUG] Successful retry can become retryable after a later database failure

**File:** [`server/google-business-profile/workflowPublishRetryService.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/google-business-profile/workflowPublishRetryService.ts#L94-L139) (lines 94, 103, 118, 133, 136, 139)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-external-side-effect-misclassification`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The retry try/catch covers the Google push and the subsequent job/draft status updates. If pushDraftToGoogle succeeds but updating restaurant_external_profile_publish_jobs or restaurant_external_profile_drafts fails, the catch classifies the database error as a Google push failure and writes status google_failed. That can expose another retry even though the previous retry may already have changed Google.

## Recommendation

After a successful Google push, handle later persistence failures as reconciliation errors rather than Google failures. Persist a non-retryable needs_reconciliation state or retry only the local status update, not the external Google mutation.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)

# [BUG] Post-Google persistence failures are treated as Google push failures

**File:** [`server/google-business-profile/workflowPublishExecution.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/google-business-profile/workflowPublishExecution.ts#L287-L322) (lines 287, 293, 302, 310, 317, 319, 321, 322)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-external-side-effect-misclassification`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

pushDraftToGoogle wraps the external Google sync calls and the later local updatePublishEvent call in one try/catch. If the Google API calls succeed but updatePublishEvent fails, or if one selected section succeeds and a later section fails, the catch records the whole Google event as failed and throws GBP_GOOGLE_PUSH_FAILED. Callers can then mark the job retryable, even though Google may already have been modified, creating duplicate or stale external writes on retry.

## Recommendation

Separate provider-side results from local persistence failures. Track per-section Google success, record a reconciliation-required state when local bookkeeping fails after an external success, and do not mark the job as retryable unless the code can prove no Google-side write occurred or the retry is idempotent against the approved snapshot.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)

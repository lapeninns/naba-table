# [BUG] Retry falls back to provider message ID instead of delivery-log ID

**File:** [`src/components/features/email-delivery/useOpsEmailDeliveryRetryState.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/email-delivery/useOpsEmailDeliveryRetryState.ts#L45) (lines 45)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-retry-identifier-mismatch`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The retry payload uses pendingRetryRow.attempt.id ?? pendingRetryRow.attempt.messageId. The traced feed builders do not populate OpsEmailDeliveryAttemptDTO.id: the ops_email_delivery_attempts_feed RPC returns messageId/events/booking fields but no attempt id, and the query fallback tracks currentEventId but does not expose it. The retry route expects a delivery_log row UUID and looks up email_delivery_log.id, so real failed/bounced rows without attempt.id will submit the provider messageId and fail validation or lookup.

## Recommendation

Expose the current retryable email_delivery_log row id as attempt.id from both the RPC and fallback feed paths, or derive it from the latest event id before retrying. Avoid falling back to provider messageId for a route that expects a delivery-log UUID.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)

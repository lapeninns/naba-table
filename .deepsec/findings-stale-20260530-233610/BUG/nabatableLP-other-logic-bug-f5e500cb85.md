# [BUG] Real email retries can submit the provider message ID instead of the delivery log ID

**File:** [`src/components/features/email-delivery/useOpsEmailDeliveryRetryState.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/email-delivery/useOpsEmailDeliveryRetryState.ts#L45) (lines 45)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The retry action posts `pendingRetryRow.attempt.id ?? pendingRetryRow.attempt.messageId` as `deliveryLogId`. The normal server feed builders in `server/emails/email-delivery-log.ts` populate attempt DTOs with `messageId`, `events`, booking data, etc., but do not populate `attempt.id`; fixture rows do include `id`, which is why fixture retry tests can pass. For real rows, this fallback sends the provider message ID to `/api/ops/email-delivery/retry`, whose schema expects a delivery-log UUID and whose retry path looks up `email_delivery_log.id`. This makes real failed/bounced retry attempts fail with invalid request or not found rather than resending the email.

## Recommendation

Do not fall back to provider `messageId` for retry identity. Populate the feed DTO with the current failed/bounced delivery log entry ID, or derive it from the current retryable event in `attempt.events`, and only call `retryEmailDelivery` when a valid delivery-log ID is available.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)

# [BUG] Successful SMS sends can be retried if post-send idempotency persistence fails

**File:** [`cloudflare/sms-summary-gateway/src/index.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/cloudflare/sms-summary-gateway/src/index.ts#L242-L432) (lines 242, 243, 362, 421, 432)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-duplicate-external-side-effect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The queue handler calls processDailySummaryDispatch and retries any non-terminal error. The idempotency client records completion only after Twilio sends by calling /complete. If the SMS send succeeds but the subsequent markSent path fails or returns an unparsable response, the error propagates to the queue catch block and the message is retried. Because the Durable Object state only has a temporary lock and no durable post-send tombstone in that failure case, a later retry after lock expiry can claim the dispatch again and send a duplicate SMS for the same restaurant/date/recipient.

## Recommendation

Persist a durable send-attempt state before calling Twilio and treat post-send persistence failures as manual-reconciliation/alert conditions rather than retrying the queue message blindly. Alternatively move the send-and-state transition behind a Durable Object-controlled workflow that retains a sent-or-unknown tombstone longer than the retry window.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-11)

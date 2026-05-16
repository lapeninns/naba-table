# [MEDIUM] Email retry endpoint has no abuse throttling

**File:** [`src/app/api/ops/email-delivery/retry/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/email-delivery/retry/route.ts#L105-L206) (lines 105, 157, 206)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The retry endpoint is an authenticated mutation that can call the paid email provider through resendBookingEmailFromDeliveryLog(), but it does not call consumeRateLimit() or enforce a per-user/per-restaurant retry budget. Any restaurant member who can discover failed or bounced delivery log IDs can repeatedly invoke the endpoint. The downstream retry path intentionally skips recent-delivery checks for retries, so provider idempotency is the only partial mitigation and should not be the only abuse control.

## Recommendation

Add a server-side rate limit keyed by user ID and restaurant ID, consider requiring an admin role for retry actions, and record/lock retry attempts so the same delivery log cannot be retried in a tight loop.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-25)

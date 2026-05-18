# [MEDIUM] Email retry action is backed by a cookie-authenticated POST without CSRF protection

**File:** [`src/components/features/email-delivery/components/OpsEmailDeliveryTable.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/email-delivery/components/OpsEmailDeliveryTable.tsx#L348-L432) (lines 348, 429, 432)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The table exposes a state-changing retry flow via the Retry button and confirmation action. Tracing onConfirmRetry through useOpsEmailDeliveryRetryState to bookingService.retryEmailDelivery shows it sends POST /api/ops/email-delivery/retry with credentials: 'include' and only a JSON Content-Type header. The route handler validates the JSON body and calls requireSession(), but it does not call validateCsrfToken() before queuing the resend. Because the operation resends booking emails and is authenticated by ambient cookies, a same-site attacker context or any browser context that can cause the victim's cookies to be sent can trigger duplicate email sends without the staff member's intent.

## Recommendation

Require validateCsrfToken(request) in src/app/api/ops/email-delivery/retry/route.ts before performing the retry, and send the x-csrf-token header from the client by using fetchJson or getBrowserCsrfToken(). Consider adding retry rate limiting or idempotency as a second guard against duplicate sends.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)

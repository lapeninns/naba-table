# [MEDIUM] Email retry can be replayed without rate limit or retry idempotency

**File:** [`src/app/api/ops/email-delivery/retry/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/email-delivery/retry/route.ts#L105-L206) (lines 105, 147, 180, 206)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Any authenticated member of the restaurant can repeatedly POST the same failed or bounced deliveryLogId. The handler has no consumeRateLimit() call, and retryEmailDeliveryLogEntry only checks that the original log entry is failed or bounced; it does not mark that original entry as consumed or enforce a cooldown. The resend path deliberately skips recent-delivery checks, so repeated calls can generate duplicate customer emails and paid provider calls.

## Recommendation

Add per-user/per-restaurant and per-deliveryLogId rate limits, enforce a retry cooldown or idempotency record, and consider restricting retry to owner/manager roles if lower-privileged staff should not be able to trigger outbound emails.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-25)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

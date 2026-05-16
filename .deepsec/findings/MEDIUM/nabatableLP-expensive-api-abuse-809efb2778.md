# [MEDIUM] Test email send endpoint can be abused to send unlimited provider emails

**File:** [`src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/test-send/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/test-send/route.ts#L33-L42) (lines 33, 39, 42)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler requires admin membership and validates toEmail only as an email-shaped string, then calls sendRestaurantBookingEmailTest. There is no consumeRateLimit call, per-recipient cooldown, or quota check before sending through Resend, and the test-send idempotency key is randomized in the email helper, so repeated identical requests are not coalesced. A compromised or abusive owner/manager account can send unlimited test emails to arbitrary external recipients, causing email provider cost and sender reputation abuse.

## Recommendation

Add rate limiting scoped by userId, restaurantId, and recipient email. Consider restricting test sends to the current user's email or verified restaurant domains by default, with audited overrides for broader sends.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-04)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

# [MEDIUM] Email retry POST lacks CSRF validation

**File:** [`src/app/api/ops/email-delivery/retry/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/email-delivery/retry/route.ts#L105-L206) (lines 105, 120, 147, 180, 206)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-missing-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route is a session-cookie authenticated POST handler: it calls requireSession() and then performs a state-changing email retry, but it never calls validateCsrfToken(). The retry can send a booking email through resendBookingEmailFromDeliveryLog. The shared CSRF helper exists and other session-cookie POST routes use it, but this handler does not. The client path for this retry also uses raw fetch rather than the shared fetchJson wrapper, so it does not attach the CSRF header either.

## Recommendation

Reject the request before parsing or mutation unless validateCsrfToken(request) succeeds, and update the client retry call to use fetchJson or explicitly send the x-csrf-token header.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-25)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

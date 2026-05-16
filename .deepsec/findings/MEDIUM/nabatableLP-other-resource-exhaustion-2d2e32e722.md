# [MEDIUM] Unsigned Twilio webhook requests can force expensive body parsing and signature work

**File:** [`src/app/api/webhook/twilio/sms-status/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/webhook/twilio/sms-status/route.ts#L55-L63) (lines 55, 61, 63)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-resource-exhaustion`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The webhook is signature-protected, and it correctly refuses requests when TWILIO_AUTH_TOKEN is missing. However, unauthenticated requests with any x-twilio-signature value still reach `await req.text()`, `new URLSearchParams(rawBody)`, and signature validation over all parsed form entries before being rejected. The Twilio signature helper sorts every form entry before HMAC validation, so an attacker can repeatedly POST large URL-encoded bodies with many parameters to consume memory and CPU without knowing the Twilio token.

## Recommendation

Reject missing signature and invalid content type before reading the body, enforce a small Content-Length/body-size and parameter-count cap for Twilio callbacks, and add IP-scoped rate limiting for failed webhook verification attempts.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-21)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

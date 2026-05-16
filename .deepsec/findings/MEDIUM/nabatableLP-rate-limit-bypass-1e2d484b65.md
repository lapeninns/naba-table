# [MEDIUM] Webhook buffers unauthenticated bodies before rejecting missing signatures

**File:** [`src/app/api/webhook/resend/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/webhook/resend/route.ts#L51-L58) (lines 51, 56, 57, 58)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The webhook reads the full request body with req.text() before checking whether the required Svix signature headers are present. An unauthenticated caller can repeatedly POST large unsigned bodies and force the route to buffer them before it returns 401. The valid Resend signature check is present, so this is not webhook forgery, but the ordering leaves the public endpoint exposed to avoidable resource exhaustion and there is no rate limit or content-length cap on failed webhook authentication attempts.

## Recommendation

Check for the Svix headers and enforce a small Content-Length limit before reading the body. Add rate limiting for failed webhook-auth attempts, then read the raw payload and call the Resend/Svix verifier.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-26)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

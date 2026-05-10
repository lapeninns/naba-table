# [HIGH] Email processing cron fails open when CRON_SECRET is unset

**File:** [`src/app/api/cron/process-emails/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/cron/process-emails/route.ts#L19-L175) (lines 19, 47, 49, 51, 59, 60, 66, 102, 146, 175)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The cron authorization helper treats a missing CRON_SECRET as a warning condition and returns null, allowing the request to proceed. Both GET and POST then execute sensitive service-role work: GET drains/finalizes queued email intents and runs delivery reconciliation, while POST accepts up to 100 caller-supplied email job envelopes and dispatches booking emails by bookingId. Although the production env schema requires CRON_SECRET, the route itself is fail-open and the base/staging schema allows it to be absent, so a misconfigured deployed non-production/staging environment exposes this endpoint publicly.

## Recommendation

Fail closed when CRON_SECRET is missing before checking Authorization, preferably via a shared cron auth helper backed by validated env. Return 500/503 for server misconfiguration or 401 for unauthorized requests, and add tests for missing, wrong, and correct bearer tokens.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-20)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

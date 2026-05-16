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

## Revalidation

**Verdict:** fixed

The current POST handler is protected by requireCronAuthAndRun with the job name process-emails:post, so request JSON parsing and processEmailJobs are inside the authenticated callback. If no cron secret is configured, requireCronAuth returns a 503 response and the callback is never invoked. If a bearer token is missing or wrong, it returns 401 before any caller-supplied job envelopes are accepted. The GET path uses the same shared guard before draining due email intents or running delivery reconciliation. The current email-processing helper also verifies booking.restaurant_id matches payload.restaurantId before dispatching, which reduces forged-job impact even after authentication. Commit 020a7389 is the patch point: it removed the fail-open CRON_SECRET branch, added requireCronAuthAndRun, capped POST jobs to 25, and changed route error responses to generic cron failure messages. The focused Vitest run passed, including the regression cases for missing CRON_SECRET and wrong bearer tokens.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

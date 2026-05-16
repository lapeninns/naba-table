# [HIGH] Email cron processor fails open when CRON_SECRET is unset

**File:** [`src/app/api/cron/process-emails/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/cron/process-emails/route.ts#L47-L175) (lines 47, 49, 59, 60, 66, 102, 146, 175)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

authorizeRequest only rejects bad bearer tokens when CRON_SECRET is present. If CRON_SECRET is missing, it logs that the endpoint is unprotected and returns null, allowing both handlers to continue. GET triggers the queued email drain, while POST accepts caller-supplied job envelopes and passes them to processEmailJobs; the traced helpers fetch bookings with the service-role client and dispatch customer emails. In any staging, preview, or misconfigured deployment without CRON_SECRET, an unauthenticated caller can drain or forge email processing work, spam customers, consume provider quota, and observe processing/error results.

## Recommendation

Make missing CRON_SECRET a hard failure before any work is performed, preferably through a shared cron auth helper backed by validated env. Return 401/503 when the secret is absent, and avoid returning raw internal error messages from cron handlers.

## Revalidation

**Verdict:** fixed

The current route no longer contains the reported authorizeRequest helper or the conditional CRON_SECRET check. Both GET and POST are wrapped in requireCronAuthAndRun before any queue drain, request-body processing, observability write, or email job execution occurs. The imported requireCronAuth implementation builds an allowed secret list from CRON_SECRETS, CRON_SECRET, and CRON_SECRET_PREVIOUS, and if that list is empty it returns a 503 response with "Cron authentication is not configured." It also rejects missing or wrong bearer tokens with 401 and only then enters runWithCronExecutionLock and the route callback. The sensitive service-role paths still exist behind triggerEmailQueueDrain and processEmailJobs, but an unauthenticated caller cannot reach them in the missing-secret case anymore. Commit 020a7389 replaced the old fail-open authorizeRequest code with requireCronAuthAndRun and removed raw internal error messages from the 500 responses. I also ran pnpm exec vitest tests/server/cron-routes-auth.test.ts tests/server/tenant-authorization-sprint2.test.ts tests/server/email-processing-security.test.ts --run, and the focused cron tests confirmed process-emails GET/POST fail closed before work when CRON_SECRET is absent.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

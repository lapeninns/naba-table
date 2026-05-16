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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-20)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

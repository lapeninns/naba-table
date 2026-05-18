# [MEDIUM] Unauthenticated cron fallback can trigger service-role reconciliation and Twilio polling

**File:** [`server/observability/delivery-reconciler.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/observability/delivery-reconciler.ts#L66-L291) (lines 66, 105, 184, 244, 291)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The reconciler is reachable from GET /api/cron/process-emails. That route's authorizeRequest only rejects bad bearer tokens when CRON_SECRET is set; when CRON_SECRET is unset it logs a warning and proceeds. This file then uses the service-role Supabase client to scan recent email/SMS delivery logs and, when Twilio read credentials exist, refreshes up to 100 SMS candidates from Twilio per run. In an environment missing CRON_SECRET, an unauthenticated requester can repeatedly force service-role database scans, third-party Twilio API calls, and observability/SMS delivery-log writes.

## Recommendation

Make the cron route hard-fail when CRON_SECRET is missing, validate the secret through the central env layer, and consider adding an execution lock or rate limit around reconciliation so it cannot be spam-triggered.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-21)

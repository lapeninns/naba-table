# [HIGH] Unprotected cron POST can process arbitrary service-role email jobs

**File:** [`server/queue/email-processing.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/queue/email-processing.ts#L20-L154) (lines 20, 22, 53, 55, 137, 140, 154)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `missing-auth`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST /api/cron/process-emails accepts processEmailJobsRequestSchema and calls processEmailJobs, while the route permits all requests when CRON_SECRET is unset. In this file, the job schema accepts caller-supplied bookingId and restaurantId, but restaurantId is never checked. fetchBooking uses the service-role client to read bookings by bookingId, and processEmailJob dispatches the requested transactional email. For types such as updated and booking_rejected, shouldSendByStatus returns true regardless of booking status, so an unauthenticated attacker in a missing-secret environment who knows a booking UUID can send misleading customer emails and abuse the paid email provider. The skipped vs non-skipped result also acts as a booking/email-status oracle.

## Recommendation

Hard-fail the cron route when CRON_SECRET is missing, authenticate queue batches with a trusted secret/signature, verify booking.restaurant_id matches payload.restaurantId before dispatch, and avoid returning per-job existence signals to unauthenticated callers.

## Revalidation

**Verdict:** fixed

The current POST /api/cron/process-emails handler is wrapped in requireCronAuthAndRun before request JSON parsing or processEmailJobs is reached. requireCronAuth fails closed with 503 when no CRON_SECRETS, CRON_SECRET, or CRON_SECRET_PREVIOUS value is configured, and returns 401 for a missing or wrong bearer token. The route also caps explicit POST batches to 25 jobs and no longer returns per-job results to the caller, only aggregate stats. In server/queue/email-processing.ts, processEmailJob now explicitly compares booking.restaurant_id with payload.restaurantId and skips tenant-mismatched jobs before checking email validity or dispatching. That removes the forged cross-tenant job path described in the finding even for authenticated cron callers. Commit 020a7389 introduced the shared cron auth helper and added the tenant-match check, so an unauthenticated missing-secret attacker can no longer trigger service-role email dispatch.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)

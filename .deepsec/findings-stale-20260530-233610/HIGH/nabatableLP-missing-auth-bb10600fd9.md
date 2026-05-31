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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-29)

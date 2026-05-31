# [MEDIUM] Queue status endpoint bypasses central cron auth hardening

**File:** [`src/app/api/admin/queue-status/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/admin/queue-status/route.ts#L9-L55) (lines 9, 13, 43, 47, 54, 55)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route is outside the /api/ops proxy guard and implements its own direct equality check against process.env.CRON_SECRET before returning email queue status. Unlike the shared requireCronAuth helper used by cron routes, this has no rate limit, no rotated-secret support, and no security-event logging for failed attempts. With includeJobs enabled it can expose booking/restaurant queue metadata, and failures return error.message plus error.stack to the client.

## Recommendation

Use the shared cron auth helper or a backend platform-admin guard for this endpoint, add rate limiting/security logging, support the same secret rotation path as other cron routes, and return generic 500 errors without stack traces.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-27)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

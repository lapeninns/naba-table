# [MEDIUM] Public booking creation trusts spoofable ops walk-in headers

**File:** [`server/bookings/bookings-post-response.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/bookings/bookings-post-response.ts#L76-L156) (lines 76, 78, 119, 156)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-header-trust`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

buildBookingsPostHttpResponse passes raw request headers into the booking create entry gate and later uses the resulting requestContext for persistence and completion. The public /api/bookings route supplies req.headers directly. The imported context builder treats x-ops-walk-in: true as an ops.walkin source and uses x-ops-email-provided to decide whether guest email notifications were provided; the side-effect payload suppresses email when isOpsWalkIn is true and x-ops-email-provided is absent. Because the root public route is unauthenticated and the proxy only strips x-ops-user-id, an unauthenticated caller can create bookings recorded as ops.walkin and suppress confirmation/reminder email delivery, for example using a victim email with an attacker-controlled phone number.

## Recommendation

Do not derive ops walk-in state from client-supplied headers on the public booking route. Pass an explicit trusted source from authenticated ops handlers only, or strip/ignore x-ops-\* headers before building public booking context.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)

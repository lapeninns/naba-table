# [MEDIUM] Public booking creation can spoof ops walk-in email suppression

**File:** [`server/jobs/booking-side-effects.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/jobs/booking-side-effects.ts#L512-L517) (lines 512, 513, 516, 517)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-trusted-header-spoofing`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

processBookingCreatedSideEffects trusts payload.emailProvided to decide whether guest email notifications and reminder scheduling should run. That payload is built from raw request headers in the public /api/bookings path: x-ops-walk-in marks the booking as an ops walk-in, and x-ops-email-provided controls emailProvided. Because the public route is unauthenticated and does not strip these internal ops headers, an attacker can create a public booking marked as ops.walkin and omit x-ops-email-provided to suppress email notifications to the supplied address, enabling stealth fake reservations and corrupting source/audit data.

## Recommendation

Do not derive ops walk-in/emailProvided state from client-supplied headers on the public route. Strip these headers for root/public traffic or only honor them after authenticated ops routing, and force public booking side effects to treat emailProvided as true.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-20)

# [MEDIUM] Public availability endpoint discloses internal booking volume and capacity metrics

**File:** [`src/app/api/availability/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/availability/route.ts#L42-L202) (lines 42, 72, 136, 178, 186, 189, 193, 200, 202)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

GET /api/availability is unauthenticated and resolves any active restaurantId, then returns detailed metadata including maxCovers, bookedCovers, availableCovers, utilizationPercent, maxParties, and bookedParties. The underlying capacity service computes these values from booking rows and table/capacity rules using the service-role client. An attacker can enumerate public restaurant IDs, dates, times, and party sizes to reconstruct occupancy patterns and booking volume. The public Cache-Control header and X-Utilization header further expose the same operational signal.

## Recommendation

For guest callers, return only coarse availability data needed to complete a booking, such as available/unavailable and allowed alternative times. Move exact covers, party counts, capacity limits, and utilization headers behind an ops endpoint with per-restaurant membership checks.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-07)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-26)

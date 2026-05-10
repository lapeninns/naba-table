# [MEDIUM] Public availability endpoint exposes exact booking capacity data

**File:** [`src/app/api/availability/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/availability/route.ts#L72-L193) (lines 72, 136, 178, 186, 189, 193)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The unauthenticated GET handler accepts an optional restaurantId, resolves it with service-role-backed helpers, checks capacity, and returns detailed operational metrics including maxCovers, bookedCovers, availableCovers, utilizationPercent, maxParties, and bookedParties. An attacker can query dates and times to reconstruct venue capacity and occupancy patterns. A guest availability endpoint only needs to return whether a slot is bookable and optionally coarse alternatives; exact counts are business-sensitive.

## Recommendation

Return only guest-safe availability fields from this public endpoint. Move exact capacity and booked-count metadata behind ops authentication and per-restaurant authorization.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-07)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-26)

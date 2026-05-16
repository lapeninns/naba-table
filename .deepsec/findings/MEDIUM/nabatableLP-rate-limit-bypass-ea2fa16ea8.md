# [MEDIUM] Availability rate limit key trusts spoofable forwarded IP input

**File:** [`src/app/api/availability/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/availability/route.ts#L91-L93) (lines 91, 93)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The availability limiter keys requests by extractClientIp(req), and that helper falls back to the first x-forwarded-for value without verifying it came from a trusted proxy. If the edge does not overwrite this header, an attacker can rotate X-Forwarded-For values to receive fresh availability:check:<restaurantId>:<ip> buckets and bypass the 20 requests per minute limit, enabling high-volume enumeration and expensive availability checks.

## Recommendation

Derive the client IP only from a trusted platform header or proxy-provided request property after stripping client-supplied forwarding headers at the edge. Add a secondary restaurant/global quota so spoofed or missing IP data cannot create unlimited buckets.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-26)

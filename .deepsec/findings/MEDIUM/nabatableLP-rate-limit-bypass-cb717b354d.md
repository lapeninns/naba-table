# [MEDIUM] Public client-error endpoint allows unauthenticated log flooding and spoofed telemetry

**File:** [`src/app/api/client-error/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/client-error/route.ts#L5-L8) (lines 5, 7, 8)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The endpoint is intentionally public, but it accepts arbitrary JSON from anyone, applies no rate limit, size limit, schema validation, or truncation, and writes attacker-controlled `path`, `message`, `stack`, `userId`, and `bookingId` values directly to server logs. An attacker can flood centralized logs, create misleading records tied to arbitrary users/bookings, and force JSON parsing/log storage work at scale.

## Recommendation

Apply `consumeRateLimit` keyed by client IP/session, enforce Content-Type and request-size limits, validate the payload shape, truncate string fields before logging, and avoid trusting client-supplied userId/bookingId unless derived from the authenticated session.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-05)

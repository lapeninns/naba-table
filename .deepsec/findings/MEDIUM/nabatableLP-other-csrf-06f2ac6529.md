# [MEDIUM] Missing CSRF validation on booking check-out mutation

**File:** [`src/app/api/ops/bookings/[id]/check-out/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/check-out/route.ts#L34-L116) (lines 34, 40, 46, 80, 91, 116)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This session-cookie POST route completes bookings, clears table assignments, invalidates dashboard caches, and schedules checkout side effects, but it does not validate the CSRF token before performing those mutations. Authentication and restaurant membership are checked in loadLifecycleRouteContext, but that only proves the request carries a valid session; it does not prove the request was intentionally initiated by the ops UI.

## Recommendation

Call validateCsrfToken(req) at the start of the handler before parsing the body or loading lifecycle context, and return 403 on failure. Add coverage that missing/invalid CSRF tokens cannot check out a booking.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-25)

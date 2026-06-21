# [MEDIUM] CSRF failures can trigger unbounded security-event writes

**File:** [`server/security/csrf.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/security/csrf.ts#L111-L123) (lines 111, 112, 116, 123)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-log-amplification`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

validateCsrfProtectedMutation records a security event for every missing or invalid CSRF token before returning 403. Because this wrapper runs before route-specific auth and rate limits, unauthenticated POST/PUT/PATCH/DELETE requests to wrapped routes can be used as a write-amplification path against observability storage.

## Recommendation

Rate-limit or sample CSRF failure logging by path and client IP before calling recordSecurityEvent, and avoid per-request database writes for repeated unauthenticated failures.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-24)

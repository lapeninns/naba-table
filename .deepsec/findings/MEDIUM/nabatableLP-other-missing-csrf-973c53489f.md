# [MEDIUM] Cookie-authenticated check-in mutation does not validate CSRF token

**File:** [`src/app/api/ops/bookings/[id]/check-in/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/check-in/route.ts#L32-L78) (lines 32, 38, 44, 78)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-missing-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler performs a state-changing booking check-in using the Supabase session cookie and per-restaurant membership checks from loadLifecycleRouteContext, but it never calls validateCsrfToken. The repo has a double-submit CSRF helper and browser clients attach x-csrf-token, so omitting server-side validation leaves this mutation exposed to same-site request-forgery gadgets or compromised sibling origins that can submit a bodyless POST with the victim's cookies.

## Recommendation

Import validateCsrfToken from server/security/csrf and reject unsafe methods with 403 or 419 before parsing and persisting the lifecycle transition.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-25)

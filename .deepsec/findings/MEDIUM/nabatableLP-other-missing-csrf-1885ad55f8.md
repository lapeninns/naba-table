# [MEDIUM] Cookie-authenticated booking creation lacks CSRF enforcement

**File:** [`src/app/api/ops/bookings/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/route.ts#L697-L1230) (lines 697, 698, 719, 934, 991, 1230)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-missing-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST authenticates via the cookie-bound Supabase session and then performs state-changing customer and booking writes, but the handler never calls the repository's validateCsrfToken helper. A browser request made with the victim staff member's cookies can create an ops walk-in booking for a restaurant the victim belongs to, because the endpoint only checks the session and restaurant membership before mutating records. The proxy sets a CSRF cookie, but this route does not require the matching x-csrf-token header.

## Recommendation

Reject unsafe methods early unless validateCsrfToken(req) succeeds. Also require an application/json content type and consider Origin/Referer checks as defense in depth for session-cookie API mutations.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-23)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

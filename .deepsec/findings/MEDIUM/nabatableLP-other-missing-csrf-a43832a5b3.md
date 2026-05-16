# [MEDIUM] Cookie-authenticated check-out mutation does not validate CSRF token

**File:** [`src/app/api/ops/bookings/[id]/check-out/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/check-out/route.ts#L34-L80) (lines 34, 40, 46, 80)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-missing-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler performs a state-changing booking check-out using the Supabase session cookie and membership checks from loadLifecycleRouteContext, but it does not validate the CSRF header/cookie pair. SameSite cookies reduce ordinary cross-site POST risk, but this repo explicitly provides CSRF validation for session-cookie mutations and clients attach the token; the server currently accepts requests without it.

## Recommendation

Validate CSRF at the start of the POST handler before parsing the request body or loading the booking, and return a failure response when the token is missing or mismatched.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-25)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

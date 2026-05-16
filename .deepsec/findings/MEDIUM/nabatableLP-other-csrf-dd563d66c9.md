# [MEDIUM] Cookie-authenticated booking creation lacks CSRF validation

**File:** [`src/app/api/ops/bookings/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/route.ts#L697-L776) (lines 697, 698, 719, 770, 776)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST authenticates with the Supabase session cookie via getRouteHandlerSupabaseClient()/auth.getUser(), parses the JSON body, then creates a booking after the restaurant membership check, but it never calls validateCsrfToken(). The repo already has a double-submit CSRF helper and other session-cookie POST routes use it. A forged same-site browser request, for example from a compromised sibling subdomain, could create walk-in bookings and trigger email/assignment side effects using the victim staff member's session.

## Recommendation

Import validateCsrfToken from server/security/csrf and reject unsafe methods before parsing the body or running side effects, returning 403/419 when the CSRF header and cookie do not match.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-23)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

# [MEDIUM] Mutating booking lifecycle endpoint does not enforce CSRF

**File:** [`src/app/api/ops/bookings/[id]/no-show/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/no-show/route.ts#L31-L91) (lines 31, 78, 91)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST /api/ops/bookings/[id]/no-show is authenticated with the Supabase session through loadLifecycleRouteContext, but the route never calls validateCsrfToken before mutating booking state via persistLifecycleTransition and clearing table assignments. The app has a double-submit CSRF helper and browser fetchJson adds x-csrf-token, but this handler does not validate it. A forged same-site request from a malicious sibling subdomain or other same-site injection point could cause an authenticated staff user to mark a known booking as no-show.

## Recommendation

Reject unsafe methods unless validateCsrfToken(req) succeeds before parsing or mutating state. Return 419/403 on failure and keep the existing frontend x-csrf-token header flow.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

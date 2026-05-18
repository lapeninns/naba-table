# [MEDIUM] Session-cookie table assignment POST lacks CSRF verification

**File:** [`src/app/api/ops/bookings/[id]/tables/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/tables/route.ts#L21-L106) (lines 21, 35, 106)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `missing-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler authenticates via Supabase cookies and mutates booking table assignments with a service-role client, but it never validates the x-csrf-token double-submit token. The frontend fetchJson helper sends the CSRF header, but without server-side validateCsrfToken enforcement the header is only advisory. In contexts where an attacker can get the victim browser to send cookies on a forged POST, this can assign a table to a booking without the operator's intent.

## Recommendation

Import validateCsrfToken from server/security/csrf and reject mutating requests with 419 before parsing the body or performing auth-dependent mutations.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)

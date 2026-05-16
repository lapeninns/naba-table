# [MEDIUM] Table assignment mutations rely on session cookies without server-side CSRF validation

**File:** [`src/components/features/dashboard/booking-details/components/TableAssignmentPanel.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/dashboard/booking-details/components/TableAssignmentPanel.tsx#L201-L236) (lines 201, 220, 236)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The panel invokes autoAssign(), apply(), and unassignAll(), which trace to POST /api/staff/auto/quote and POST/DELETE /api/ops/bookings/[id]/assign-tables. The browser fetch helper adds an x-csrf-token header, but the traced route handlers do not call validateCsrfToken(req); they only authenticate with Supabase session cookies. Because the app already has double-submit CSRF helpers and the repo contract requires mutating session-cookie handlers to verify them, a same-site attacker context that can send credentialed simple requests could trigger table holds, assignments, or unassignments without the victim intentionally performing the action.

## Recommendation

Validate validateCsrfToken(req) at the start of the affected mutating route handlers and return 419 on failure. Keep the existing client-side CSRF header injection, and cover POST and DELETE table-assignment paths consistently.

## Revalidation

**Verdict:** true-positive

This is partially fixed but still exploitable through the quote leg of the panel flow. The current /api/ops/bookings/[id]/assign-tables POST and DELETE handlers are wrapped in withCsrfProtectedMutation, so the apply() and unassignAll() paths no longer rely only on session cookies. However, /api/staff/auto/quote still imports no CSRF helper and performs no validateCsrfToken or withCsrfProtectedMutation check before parsing JSON, resolving the Supabase user from cookies, checking membership, and calling quoteTables. The browser fetchJson helper adds x-csrf-token, but the server route does not require it, so the client-side header is not a defense. A same-site attacker context that can send credentialed POSTs and knows a booking UUID for the victim's restaurant can create table_holds by hitting /api/staff/auto/quote, although it cannot directly assign or unassign tables through the patched assign-tables route. Because quoteTables persists holds that participate in planner availability, the remaining CSRF impact is unauthorized hold creation and availability disruption rather than direct assignment mutation.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)

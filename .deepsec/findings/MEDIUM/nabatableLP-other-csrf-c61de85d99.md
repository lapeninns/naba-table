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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

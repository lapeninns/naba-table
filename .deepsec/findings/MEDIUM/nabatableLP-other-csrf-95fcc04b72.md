# [MEDIUM] Table and zone mutations do not enforce CSRF validation

**File:** [`src/app/app/(app)/settings/restaurant/tables/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/settings/restaurant/tables/page.tsx#L12>) (lines 12)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The table settings client performs cookie-authenticated POST/PATCH/DELETE requests to table and zone APIs. Those mutating handlers do not call validateCsrfToken; the client helper adds a CSRF header, but the server accepts requests without verifying it. If an authenticated staff browser can be induced to send same-site requests, seating layout and capacity can be changed without user intent.

## Recommendation

Add validateCsrfToken checks to all mutating /api/ops/tables and /api/ops/zones handlers before reading the body or performing writes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

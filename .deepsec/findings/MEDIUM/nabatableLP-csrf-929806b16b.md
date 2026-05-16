# [MEDIUM] Staff auto-quote creates table holds without CSRF validation

**File:** [`src/app/api/staff/auto/quote/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/staff/auto/quote/route.ts#L20-L74) (lines 20, 21, 32, 56, 71, 74)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `csrf`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The POST handler relies on cookie-bound Supabase authentication, then creates tenant-scoped table holds through quoteTables, but it never validates the CSRF header that the frontend fetchJson helper sends. A forged same-site browser request for a known bookingId could make an authenticated staff member create capacity-blocking table holds without intent.

## Recommendation

Validate the double-submit CSRF token with validateCsrfToken(req) before parsing the body or creating holds, and reject missing or mismatched tokens with 403/419. Enforce application/json if this endpoint is only meant for fetchJson clients.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-07)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

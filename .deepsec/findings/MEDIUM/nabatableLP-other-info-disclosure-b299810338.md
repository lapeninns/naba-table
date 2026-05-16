# [MEDIUM] Internal Supabase and assignment errors are returned to clients

**File:** [`src/app/api/staff/auto/confirm/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/staff/auto/confirm/route.ts#L45-L94) (lines 45, 46, 61, 62, 87, 88, 89, 92, 93, 94)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The handler returns holdLookup.error.message and membership.error.message directly, maps AssignTablesRpcError into a response containing message/details/hint, and returns unexpected Error.message for 500s. Authenticated callers can receive internal database, RPC, policy, or operational details during failure cases instead of stable public error codes.

## Recommendation

Log internal errors server-side and return generic messages for 5xx and unexpected assignment failures. Expose only stable application error codes and sanitized validation details needed by the UI.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)

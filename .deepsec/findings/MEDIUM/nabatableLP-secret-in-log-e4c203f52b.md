# [MEDIUM] Soft-hold session tokens are written to logs

**File:** [`server/capacity/table-assignment/manual.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/manual.ts#L785-L1258) (lines 785, 1258)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `secret-in-log`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

On soft-hold release failures, the code logs effectiveSessionToken or softHoldResult.sessionToken. These tokens are bearer-like capabilities used by the soft-hold ownership and release RPCs, so logging them exposes short-lived lock control material to anyone with log access.

## Recommendation

Remove the token from logs, or log only a one-way hash/truncated correlation identifier that cannot be used with soft-hold RPCs.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

**Verdict:** fixed

The two reported soft-hold release warning payloads now log booking/hold/error context only and no longer include `effectiveSessionToken`, `softHoldResult.sessionToken`, or a `sessionToken` field. The source safety test locks the two warning blocks against token fields.

Validation: `pnpm exec vitest run tests/scripts/db-safety.test.ts tests/lib/logger-redaction.test.ts tests/lib/analytics-schema.test.ts tests/lib/analytics.test.ts`

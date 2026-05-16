# [BUG] SQL execution failures exit successfully

**File:** [`scripts/execute-sql.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/execute-sql.ts#L31-L35) (lines 31, 32, 34, 35)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-silent-failure`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The catch block logs errors but does not rethrow or set a non-zero exit code. Failures from connecting, reading the SQL file, or executing SQL are swallowed, so automation can treat a failed database operation as successful. This is concrete today because generate_bookings.sql is not present in the repository, making the script fail at readFileSync while still resolving normally.

## Recommendation

Validate that the SQL file exists before connecting, and on any failure set process.exitCode = 1 or rethrow so the script exits non-zero.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-28)

**Verdict:** fixed

`scripts/execute-sql.ts` now validates the SQL file before constructing the pg client, sets `process.exitCode = 1` for caught connect/query failures, and has a top-level `.catch` that exits with code 1 for guard or preflight failures. Focused script-safety tests assert the file preflight happens before client construction and the staging guard runs before connection.

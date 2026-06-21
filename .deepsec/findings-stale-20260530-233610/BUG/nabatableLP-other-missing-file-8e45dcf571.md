# [BUG] Script references a missing SQL file

**File:** [`scripts/execute-sql.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/execute-sql.ts#L17-L31) (lines 17, 31)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-missing-file`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script resolves its SQL payload to generate_bookings.sql at the repository root, but that file is not present in the tracked repository. With a valid database URL, the script connects to the database and then fails at readFileSync, so the script cannot successfully perform its intended operation and performs an unnecessary remote database connection before discovering the missing input.

## Recommendation

Restore the intended SQL file, update sqlPath to an existing tracked SQL file, or remove this obsolete script. Check that the SQL file exists and is non-empty before opening a database connection.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-28)

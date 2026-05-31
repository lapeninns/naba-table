# [MEDIUM] Database password is accepted and documented as a command-line argument

**File:** [`scripts/find-supabase-region.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/find-supabase-region.ts#L6-L14) (lines 6, 14)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script reads the Supabase database password from process.argv[3], and the usage text recommends passing <db_password> on the command line. Command-line arguments can be exposed through shell history, terminal logs, CI logs, and local process listings.

## Recommendation

Remove positional password support. Require SUPABASE_DB_PASSWORD from a secret-managed environment variable or read it from an interactive hidden prompt/stdin.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

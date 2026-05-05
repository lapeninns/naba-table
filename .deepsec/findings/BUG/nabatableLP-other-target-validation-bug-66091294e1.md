# [BUG] Expected project-ref guard is substring-based

**File:** [`scripts/apply-sql-file.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/apply-sql-file.ts#L69-L122) (lines 69, 73, 92, 122)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-target-validation-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

`isSafeExpectedRef` accepts any connection string that merely contains the expected ref anywhere. That means a wrong host can pass if the ref appears in the password, username, query string, or another unrelated part of the URL. This weakens the safety guard before running arbitrary SQL.

## Recommendation

Parse the connection string and compare the Supabase project ref exactly from trusted locations, such as `db.<ref>.supabase.co` or `postgres.<ref>` pooler usernames. Reject empty refs and malformed/non-Supabase hosts when an expected ref is supplied.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

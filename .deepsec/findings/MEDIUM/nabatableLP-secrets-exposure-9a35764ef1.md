# [MEDIUM] Generated staff credential CSV is written without restrictive permissions

**File:** [`scripts/staging/import-prod-staff.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/import-prod-staff.ts#L322-L335) (lines 322, 324, 330, 334, 335)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script writes generated login passwords to backups/staging-staff-creds-\*.csv but does not pass mode: 0o600. Node will create the file using the process umask, which commonly leaves it group- or world-readable on shared systems. This is especially risky if the destination safety issue causes production-capable credentials to be generated.

## Recommendation

Write credential files with mode: 0o600, consider restricting the backups directory permissions, and only generate the CSV after the destination project has been verified as staging.

## Revalidation

**Verdict:** true-positive

This duplicate credential-file finding is still valid. The output path is `backups/staging-staff-creds-*.csv`, and the file contents include `email,password,role,restaurants_access_count,user_id`. The write call does not specify a restrictive file mode, so the resulting permissions depend on the process umask rather than an explicit secret-handling policy. A common umask such as `022` leaves the file group/world-readable. Nothing in the script restricts the parent `backups` directory permissions either.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

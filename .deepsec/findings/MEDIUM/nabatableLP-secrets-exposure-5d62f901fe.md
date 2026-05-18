# [MEDIUM] Generated staff credential CSV is not written with restrictive permissions

**File:** [`scripts/staging/import-prod-staff.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/import-prod-staff.ts#L307-L318) (lines 307, 313, 318)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script writes generated staff login credentials to `backups/staging-staff-creds-*.csv`, but unlike `bootstrap-owner.ts`, it does not pass `mode: 0o600`. Node will create the file with default permissions masked by the process umask, commonly making it group/world-readable on shared systems.

## Recommendation

Write the CSV with `mode: 0o600`, ensure the parent directory is not world-readable where possible, and avoid writing production-capable credentials unless the destination project has been verified as staging.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

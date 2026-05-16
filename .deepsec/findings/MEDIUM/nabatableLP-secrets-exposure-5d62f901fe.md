# [MEDIUM] Generated staff credential CSV is not written with restrictive permissions

**File:** [`scripts/staging/import-prod-staff.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/import-prod-staff.ts#L307-L318) (lines 307, 313, 318)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script writes generated staff login credentials to `backups/staging-staff-creds-*.csv`, but unlike `bootstrap-owner.ts`, it does not pass `mode: 0o600`. Node will create the file with default permissions masked by the process umask, commonly making it group/world-readable on shared systems.

## Recommendation

Write the CSV with `mode: 0o600`, ensure the parent directory is not world-readable where possible, and avoid writing production-capable credentials unless the destination project has been verified as staging.

## Revalidation

**Verdict:** true-positive

The script still writes the credential CSV with `fs.writeFileSync(outPath, header + lines + '\n', { encoding: 'utf-8' })`. It does not pass `mode: 0o600`, and it creates the `backups` directory with default directory permissions via `fs.mkdirSync(..., { recursive: true })`. On typical systems, Node creates the file using `0o666` masked by the process umask, often resulting in `0644`. The CSV contains generated staff passwords and user IDs, so a shared host or permissive backup directory can expose login credentials. The risk is amplified by the still-real destination safety issue because those credentials may become production-capable if the destination points at production.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

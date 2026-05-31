# [HIGH] DB project-ref guard can be bypassed with an attacker-controlled host

**File:** [`scripts/run-schema-optimization.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/run-schema-optimization.ts#L17-L285) (lines 17, 276, 285)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script reads SUPABASE_DB_URL, validates it through assertStagingScriptSafety, then creates a privileged pg Client from the same connection string. The imported guard extracts the project ref from the Postgres username when the host is not a db.<ref> Supabase host, but it does not require the hostname to be a Supabase pooler/database domain. A connection string such as postgresql://postgres.<expected_staging_ref>:<real_password>@<attacker_host>/postgres can pass the staging project-ref check and then send the database password and migration traffic to the attacker-controlled host.

## Recommendation

Harden the shared DB URL validator to require an allowed Supabase hostname pattern, such as db.<ref>.supabase.co or the known Supabase pooler domains, before accepting a project ref from either the host or username. Reject arbitrary hosts even when the username contains the expected project ref.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

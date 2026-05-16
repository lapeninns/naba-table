# [HIGH_BUG] Performance seed can write staging data to the wrong database

**File:** [`scripts/staging/seed-perf-dataset.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/seed-perf-dataset.ts#L83-L888) (lines 83, 95, 103, 813, 858, 885, 888)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-prod-safety-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

--apply only checks supabase/.temp/project-ref, but the actual Postgres connection comes from supabase/.temp/pooler-url, SUPABASE_DB_URL, or DATABASE_URL and is not verified against that expected ref. A stale project-ref file plus a production DB URL/password would pass the guard and then insert/update seed restaurants, memberships, customers, bookings, and table assignments in the connected database.

## Recommendation

Validate the actual connection string target before connecting or writing. Parse the Supabase project ref from the DB URL or pooler URL, require APP_ENV/DB_TARGET_ENV=staging, and abort if the target is not the approved staging ref.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

# [HIGH_BUG] Production SMS backfill applies with only a single CLI flag

**File:** [`scripts/backfill-sms-delivery.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/backfill-sms-delivery.ts#L25-L295) (lines 25, 26, 92, 94, 131, 144, 290, 295)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-production-safety`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script defaults to env=production, loads production env files, creates a service-role Supabase client, and inserts sms_delivery_log rows whenever --apply is present. There is no CONFIRM_PRODUCTION, DB_TARGET_ENV/APP_ENV, or exact Supabase project-ref check before production mutation, so an accidental command can write historical delivery records across all restaurants.

## Recommendation

Default to staging or dry-run, require CONFIRM_PRODUCTION=true and an exact EXPECTED_PROJECT_REF for production apply, validate the Supabase API host with the shared safety helper, and fail closed when target environment metadata is missing.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-13)

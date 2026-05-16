# [HIGH_BUG] Apply mode globally enables review emails outside the filtered backfill

**File:** [`scripts/backfill-review-emails.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/backfill-review-emails.ts#L21-L345) (lines 21, 22, 31, 335, 338, 341, 343, 345)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-broad-production-mutation`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

In apply mode, UPDATE_EMAIL_PREFS defaults to true and the script updates email_send_review_request to true for every restaurant where it is false before processing the filtered booking candidates. This happens even when EMAIL_FILTER is left at its narrow default. Because the script uses a service-role client and has no project-ref or production confirmation gate, an operator intending to backfill one filtered set can silently change review-email preferences across the whole remote database.

## Recommendation

Default UPDATE_EMAIL_PREFS to false, require a separate explicit confirmation for global restaurant preference changes, scope preference updates to restaurants with selected candidates, and add target environment/project-ref validation before apply-mode writes.

## Revalidation

**Verdict:** fixed

`scripts/backfill-review-emails.ts` now defaults `UPDATE_EMAIL_PREFS` to off, requires `CONFIRM_REVIEW_EMAIL_PREF_UPDATE=true` before any preference mutation, and only updates restaurants collected in `restaurantsNeedingPreferenceUpdate` after selected booking candidates exist. Apply mode now requires an exact production Supabase API project-ref check through `assertProductionApiScriptSafety`, `DB_TARGET_ENV=production` or `APP_ENV=production`, `CONFIRM_REVIEW_EMAIL_BACKFILL=true`, and either `TARGET_RESTAURANT_ID`/`RESTAURANT_ID` or the explicit all-restaurant gate `ALLOW_ALL_RESTAURANTS_BACKFILL=true` plus `CONFIRM_REVIEW_EMAIL_GLOBAL_BACKFILL=true`, before the service-role client is constructed. Focused script tests cover the guard order and preference-update scoping.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-19)

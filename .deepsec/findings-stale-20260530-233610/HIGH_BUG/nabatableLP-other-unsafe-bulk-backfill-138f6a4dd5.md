# [HIGH_BUG] Apply mode can mutate all restaurants and schedule review emails without target safety gates

**File:** [`scripts/backfill-review-emails.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/backfill-review-emails.ts#L17-L488) (lines 17, 21, 31, 322, 335, 338, 341, 343, 430, 473, 488)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-unsafe-bulk-backfill`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

After loading .env.local, APPLY can be enabled with --apply or APPLY=true and the script uses a service-role client to process every restaurant. In apply mode, UPDATE_EMAIL_PREFS defaults to true and sets email_send_review_request=true for all restaurants where it is false, then matching bookings are transitioned through check-in/check-out and review side effects are enqueued. There is no APP_ENV/DB_TARGET_ENV guard, target project check, mandatory restaurant scope, or production confirmation. An accidental production run can mutate cross-tenant booking state and email preferences and trigger guest review emails.

## Recommendation

Require explicit environment and restaurant scope for apply mode, run/replicate validate-env production-resource checks, default UPDATE_EMAIL_PREFS to false, and require a separate production confirmation for any all-restaurant run.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-19)

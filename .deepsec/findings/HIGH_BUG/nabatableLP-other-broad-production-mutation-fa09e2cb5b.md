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

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-19)

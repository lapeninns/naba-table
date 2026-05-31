# [HIGH_BUG] Restaurant seed can grant owner role to the first auth user in the target project

**File:** [`scripts/seed-restaurant.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/seed-restaurant.ts#L14-L122) (lines 14, 75, 80, 95, 105, 116, 122)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-unsafe-privilege-grant`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script loads .env.local, creates a service-role client, and creates a restaurant. If OWNER_USER_ID and OWNER_EMAIL are absent, it lists auth users and uses the first user as the owner, then createRestaurant inserts an owner membership for that user. With production credentials, an accidental run can create a production tenant and grant owner access to an unintended account.

## Recommendation

Make OWNER_USER_ID or OWNER_EMAIL mandatory, require explicit target/environment confirmation, and refuse production by default unless a dedicated production seed confirmation is present.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

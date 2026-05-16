# [HIGH_BUG] Operating-hours replacement can leave a restaurant with no schedule

**File:** [`server/restaurants/operatingHours.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/operatingHours.ts#L378-L389) (lines 378, 389)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-write`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

updateOperatingHours() deletes all operating-hours rows for the restaurant and then inserts the replacement rows in a separate statement. If the insert fails after the delete, the restaurant is left without its prior schedule. This is easy to trigger accidentally or maliciously with duplicate override IDs or any database constraint failure, and it also amplifies the missing-authorization onboarding route into a simple schedule-wipe primitive.

## Recommendation

Replace the delete-then-insert sequence with a single transactional RPC. Validate duplicate override IDs/dates and weekly coverage before mutating, and roll back the delete if any insert fails.

## Revalidation

**Verdict:** true-positive

updateOperatingHours still performs a delete of all restaurant_operating_hours rows and then a separate insert of the replacement rows. There is no transaction, RPC, or rollback between those two database operations. The helper validates weekly duplicate days, but it does not reject duplicate override ids or validate that an override date is a real calendar date beyond the YYYY-MM-DD regex. The ops PUT route accepts optional override UUIDs, so a duplicate override id in one payload can cause the insert to fail after the delete has already succeeded. An invalid date string that matches the regex can similarly fail at the database cast after deletion. A restaurant admin or sync path can therefore wipe the schedule on insert failure, so the finding is real.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

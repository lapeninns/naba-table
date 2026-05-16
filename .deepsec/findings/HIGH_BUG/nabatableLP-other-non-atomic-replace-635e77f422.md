# [HIGH_BUG] Operating-hours replacement can leave a restaurant with no schedule on insert failure

**File:** [`server/restaurants/operatingHours.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/operatingHours.ts#L349-L389) (lines 349, 378, 389)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-replace`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

updateOperatingHours validates the payload, deletes every operating-hours row for the restaurant, and then inserts the replacement rows. If insert fails after deletion, for example because duplicate override ids or invalid dates pass local validation but fail database constraints/casts, the restaurant schedule is wiped and the function returns an error.

## Recommendation

Replace the delete+insert sequence with an atomic database transaction/RPC. Validate actual calendar dates and duplicate override ids before deleting existing rows.

## Revalidation

**Verdict:** true-positive

The current replacement algorithm deletes all operating-hours rows for the restaurant before attempting the replacement insert. If the later insert fails, the function throws and returns without restoring the previous schedule. The validation catches duplicate weekly days, but it does not de-duplicate override ids and only regex-checks override dates. The ops route schema also allows caller-supplied override ids, so a duplicate id payload can produce a primary-key conflict after deletion. Because the delete and insert are separate Supabase requests, normal database transaction semantics do not protect the old rows. This is a concrete, reachable data-loss bug for authorized restaurant writers and sync jobs.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

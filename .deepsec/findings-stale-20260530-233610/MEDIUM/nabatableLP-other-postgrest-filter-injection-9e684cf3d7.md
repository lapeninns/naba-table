# [MEDIUM] Email validation allows PostgREST filter metacharacters

**File:** [`src/app/api/ops/bookings/schema.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/schema.ts#L10-L66) (lines 10, 66)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-postgrest-filter-injection`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

optionalEmailSchema accepts the shared isEmail regex, which allows characters such as double quotes and commas. The validated email is later passed into upsertCustomer, whose customer lookup builds a raw PostgREST .or() filter like email_normalized.eq."${email}" without escaping. A crafted email such as x",id.not.is.null,email_normalized.eq."y@z.co can pass validation and inject extra OR predicates, causing an arbitrary same-restaurant customer row to be selected and potentially updated or linked to the new booking.

## Recommendation

Avoid raw string-built PostgREST filters for user input; use separate parameterized queries or a properly escaped filter builder. Also harden this schema to reject PostgREST control characters unless the storage/query layer safely escapes them.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-23)

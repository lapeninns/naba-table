# [MEDIUM] Customer PII is written to server logs

**File:** [`server/customers.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/customers.ts#L117-L159) (lines 117, 119, 120, 159)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

upsertCustomer logs normalized email and phone for every customer resolution, and logs update payloads that may include a guest name or phone. This helper is used by public booking creation, so attacker-supplied and real guest PII can be copied into production logs outside the database access controls and retention model.

## Recommendation

Remove contact values from these logs, or log only stable non-reversible hashes and non-PII identifiers such as restaurant id and customer id.

## Revalidation

**Verdict:** true-positive

`upsertCustomer` logs normalized email and phone in the `Resolving customer` message for every call. It also logs update payloads, which can include a supplied name and phone, and logs customer IDs tied to those contact values. This helper is called from public booking creation using unauthenticated guest input and a service-role client. Those logs can therefore contain real guest contact information outside the database access-control and retention model. I did not find redaction or hashing applied to these specific log statements. The finding is exploitable by ordinary booking submissions and affects production observability data.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-27)

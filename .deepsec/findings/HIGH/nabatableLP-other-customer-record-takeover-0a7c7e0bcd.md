# [HIGH] Unauthenticated booking input can overwrite an existing customer's phone and expose that customer's bookings

**File:** [`server/customers.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/customers.ts#L125-L155) (lines 125, 129, 154, 155)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-customer-record-takeover`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

upsertCustomer selects an existing customer when either normalized email or normalized phone matches. Public booking creation passes unauthenticated guest input to this helper with a service-role client. An attacker can submit a victim's email with the attacker's valid phone; the lookup matches the victim by email, then overwrites the customer's phone. The public booking flow later fetches bookings for that customer contact and returns the customer's active bookings, which are selected with \* in server/bookings.ts and include sensitive booking fields.

## Recommendation

Do not merge customer identities on a partial contact match from unauthenticated input. Require both supplied contact methods to match the same customer before reuse, only fill missing contact fields after verification, or create a separate customer record when email and phone disagree. Also avoid returning full booking rows from guest lookup paths.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-27)

**Verdict:** fixed

Public booking creation now calls `upsertCustomer` with `identityMatchMode: 'strict'` and `allowExistingUpdates: false`, so unauthenticated input must match both normalized email and normalized phone on the same customer row before an existing customer id is reused. Strict duplicate-insert recovery also retries the same full-contact lookup and does not fall back to email-only or phone-only matching. Trusted ops flows can still opt into partial matching with explicit existing-profile updates, but the public guest create path cannot attach an attacker-controlled phone to an email-only customer record.

Evidence: `pnpm exec vitest run tests/server/customers.test.ts tests/server/public-bookings-route.test.ts` passed on 2026-05-16. The regression coverage verifies strict public insert conflicts do not fall back to a single email match, and verifies `/api/bookings` uses strict, non-mutating customer identity options before booking creation.

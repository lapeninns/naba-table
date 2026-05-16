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

## Revalidation

**Verdict:** true-positive

The current code narrows but does not eliminate the issue. `upsertCustomer` resolves an existing customer by email first and phone second through `findCustomerByNormalizedIdentity`, so unauthenticated public booking input can still select an existing customer by email alone. It no longer overwrites a populated `phone_normalized`, but it intentionally fills a missing phone with the caller-supplied phone, and the tests explicitly cover that behavior. After that, `fetchBookingsForContact` requires both email and phone to match the customer record, then returns all active bookings for that `customer_id` using `BOOKING_SELECT = '*'`. An attacker who knows a victim email and targets a customer record with no stored phone can attach the attacker's phone through booking creation, then use the public lookup to retrieve that customer's active bookings. The exploit is narrower than the original wording because conflicting populated phones are preserved, but the unauthenticated identity merge and booking exposure remain real.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-27)

# [HIGH] Partial contact matching can disclose existing bookings and poison customer records

**File:** [`src/app/api/bookings/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/bookings/route.ts#L1024-L1463) (lines 1024, 1045, 1054, 1461, 1463)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-partial-contact-takeover`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST /api/bookings sends untrusted email/phone to upsertCustomer, whose lookup matches existing customers by email OR phone and may update the existing customer phone. The route then builds idempotency/recovery around that customer id and returns recoveredExisting bookings plus confirmationToken in the response. An attacker who knows one contact method and a booking slot can bind to the victim customer, recover an existing booking, and receive the full booking/token; with a known email they can also overwrite the stored customer phone during the unauthenticated create flow.

## Recommendation

Do not merge unauthenticated booking submissions into an existing customer on a single contact match. Require both supplied contact methods to match the same customer before reuse, avoid mutating existing customer PII from public creates, and never return raw recovered booking rows or tokens without verifying the caller controls the booking/contact.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-24)

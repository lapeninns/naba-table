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

## Revalidation

**Verdict:** true-positive

POST /api/bookings is public on the guest/root host and sends the supplied contact data directly to upsertCustomer. upsertCustomer calls findCustomerByNormalizedIdentity, which looks up by normalized email first and then by normalized phone, so a single matching contact method is enough to reuse an existing customer id. The update behavior is narrower than the finding states because it only adds a phone when the existing customer lacks phone_normalized, but it can still mutate missing profile fields such as phone, full_name, and marketing opt-in. After customer reuse, the route derives idempotency and duplicate recovery from that customer id plus booking date/start/end. An attacker who knows either the victim email or phone and the reservation slot can cause recoverBookingRecord to return the victim's existing booking. The response maps it through toGuestBookingDTO, which still includes customer_email, customer_phone, client_request_id, idempotency_key, notes, and other booking metadata. The route also sets sr_confirm from finalBooking.confirmation_token when present, and sets an sr_access session-recovery token for finalBooking.customer_email and finalBooking.customer_phone when the recovery secret is configured. If no existing booking is recovered, the attacker can still create a new booking associated with the victim customer id based on a single contact match.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)

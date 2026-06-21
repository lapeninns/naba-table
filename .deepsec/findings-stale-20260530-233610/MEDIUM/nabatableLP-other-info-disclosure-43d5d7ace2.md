# [MEDIUM] Public contact lookup returns unmasked guest booking PII

**File:** [`src/app/api/bookings/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/bookings/route.ts#L11) (lines 11)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The public GET handler delegates unauthenticated contact lookup to buildBookingsGetHttpResponse. When no recovery token is supplied, the traced helper accepts email, phone, and optional restaurantId, then fetches matching bookings and serializes them with customer_name, customer_email, and customer_phone unmasked. An attacker who knows or guesses a guest email/phone pair can confirm booking existence and retrieve booking details plus customer name/contact fields without a one-time token. Rate limiting reduces brute force but does not make email+phone a strong authorization factor.

## Recommendation

Require a valid session recovery token for returning booking/customer details, or return only minimal masked summaries for contact-query mode. Avoid returning customer_name, customer_email, customer_phone, booking ids, or precise timing unless a token or authenticated session proves ownership.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)

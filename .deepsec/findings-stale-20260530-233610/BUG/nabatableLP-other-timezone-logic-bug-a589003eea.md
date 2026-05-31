# [BUG] Calendar/share times are built in the browser timezone instead of the restaurant timezone

**File:** [`reserve/features/reservations/wizard/hooks/useConfirmationStep.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/reserve/features/reservations/wizard/hooks/useConfirmationStep.ts#L47-L200) (lines 47, 48, 68, 200)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-timezone-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

buildReservationWindow combines the booking date and time into an ISO-like string and passes it to new Date(), which interprets the value in the guest browser's local timezone. The hook later serializes those Date objects with toISOString() for sharePayload, and the confirmation UI also uses them for Google/Outlook/ICS calendar actions. Because the restaurant timezone is available on state.details.restaurantTimezone but is not used to construct the Date objects, guests outside the restaurant timezone can download or open calendar events at the wrong absolute time.

## Recommendation

Construct the reservation window in the restaurant timezone, for example with Luxon DateTime.fromISO(`${date}T${normalizedTime}`, { zone: venue.timezone }).toUTC(), or generate calendar payloads with an explicit TZID matching the restaurant timezone.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-20)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

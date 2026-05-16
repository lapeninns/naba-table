# [MEDIUM] Contact details are retained much longer than the UI tells users

**File:** [`reserve/features/reservations/wizard/ui/steps/DetailsStep.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/reserve/features/reservations/wizard/ui/steps/DetailsStep.tsx#L300) (lines 300)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-privacy-retention`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The details step tells users that saved contact details are stored on the device for 6 hours. Tracing the remember-details flow shows that the checkbox updates wizard state, and useRememberedContacts persists name, email, and phone to localStorage with REMEMBERED_CONTACT_TTL_MS = 30 days. On a shared browser profile or venue/kiosk device, a later user can load the customer booking flow within that 30-day window and have the previous user's contact details hydrated into the form, despite the user consenting to a 6-hour retention window.

## Recommendation

Make the implementation and consent text match. Either reduce the remembered-contact TTL to 6 hours, or update the UI to clearly state the 30-day retention period. For shared-device safety, prefer sessionStorage for short-lived draft recovery and only use localStorage for an explicit longer retention choice.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)

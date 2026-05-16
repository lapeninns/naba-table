# [MEDIUM] Public booking contact data can poison authenticated profile fields

**File:** [`lib/profile/server.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/lib/profile/server.ts#L90-L231) (lines 90, 94, 97, 120, 125, 132, 218, 221, 231)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-profile-poisoning`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

ensureProfileRow hydrates missing profile name/phone from the latest customers row with the same normalized email, using the service-role client and no check that the customer row is linked to the authenticated user. The traced public booking flow accepts arbitrary name/email/phone and stores it as a customer record, so an attacker who knows a victim email can create a booking with attacker-controlled contact data. When the victim later loads their profile while those fields are missing, this code copies the attacker's customer full_name/phone into the victim profile. The reservation wizard then locks authenticated users to profile contact fields, so this can misdirect future booking contact details or notifications.

## Recommendation

Do not hydrate profiles from unverified customer rows selected only by email. Only use customer rows already linked to the same auth_user_id/user profile, or require explicit user confirmation before importing customer contact data. Avoid service-role unscoped email lookups here, and keep any hydration write conditional on trusted ownership.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)

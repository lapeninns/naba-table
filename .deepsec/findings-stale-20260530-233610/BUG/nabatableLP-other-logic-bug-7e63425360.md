# [BUG] Submitted invitation name is validated but discarded

**File:** [`src/app/api/team/invitations/[token]/accept/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/team/invitations/[token]/accept/route.ts#L18-L93) (lines 18, 35, 87, 93)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route defines and validates a name field, while the invite acceptance UI collects a full name, but parsedPayload.data is never used. The membership accept call receives only invite and session identity, and ensureProfileRow uses Supabase user metadata or existing contact data, so a newly invited user's submitted name can be silently lost.

## Recommendation

Either remove the unused name field from the route/client flow, or make it required server-side and persist it to the profile during invite acceptance.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)

# [MEDIUM] Service-role booking lookup runs before authentication

**File:** [`src/app/api/reservations/[id]/confirmation/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/reservations/[id]/confirmation/route.ts#L40-L89) (lines 40, 41, 46, 54, 58, 89)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler uses getServiceSupabaseClient() to query bookings by the user-controlled route id before checking either a session recovery token or a logged-in Supabase user. Because the code returns 404 when no booking is found before reaching the later auth branches, but returns 401/403 for existing bookings without valid access, an unauthenticated attacker can distinguish valid reservation ids from invalid ones. Invalid non-UUID ids can also force a service-role database error path before any credential check. The data returned is limited, but this is still a booking existence oracle and unnecessary service-role work on an unauthenticated path.

## Recommendation

Validate the route id format before any database call. For requests without a recovery token, resolve the user session before loading the booking. For recovery-token requests, validate the token signature before the service-role lookup, then load the booking only to perform the contact match. Return a uniform unauthenticated response before authorization is established so booking existence is not exposed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-13)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

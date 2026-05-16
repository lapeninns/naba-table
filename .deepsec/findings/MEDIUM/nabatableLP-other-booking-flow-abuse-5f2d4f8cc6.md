# [MEDIUM] Online party-size cap is only enforced client-side

**File:** [`reserve/features/reservations/wizard/ui/steps/plan-step/components/PartySizeField.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/reserve/features/reservations/wizard/ui/steps/plan-step/components/PartySizeField.tsx#L8-L31) (lines 8, 23, 24, 27, 31)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-booking-flow-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The component imports MAX_ONLINE_PARTY_SIZE and disables increments above the client limit, but this is not a security boundary. Tracing the submit path shows the public booking API schema in src/app/api/bookings/route.ts accepts party with only z.number().int().min(1), then passes data.party into duration and capacity/booking creation. A direct unauthenticated POST to /bookings can therefore request parties greater than the advertised online limit of 12 whenever capacity permits, bypassing the call-us flow and potentially consuming excessive covers or blocking inventory with a single booking.

## Recommendation

Enforce MAX_ONLINE_PARTY_SIZE in the server-side public booking schema and validation path before capacity checks. If larger parties are allowed for staff, make that an explicit authenticated ops/admin override and add direct API tests for party > 12 rejection.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-01)

**Verdict:** fixed

The public booking schema now enforces `MAX_ONLINE_PARTY_SIZE` server-side, so unauthenticated direct POSTs above the online party cap are rejected during payload validation before customer upsert, capacity checks, or booking creation.

Validation: `pnpm exec vitest run tests/server/booking-validation-security.test.ts tests/server/public-bookings-route.test.ts tests/server/ops-bookings-create-route.test.ts tests/server/public-booking-delete-route.test.ts tests/server/public-booking-session-recovery-source.test.ts tests/server/resend-webhook-route.test.ts`

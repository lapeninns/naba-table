---
task: guest-booking-lifecycle-validation-rerun
timestamp_utc: 2026-03-25T18:00:52Z
owner: github:@openai
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest booking lifecycle validation rerun

## Objective

We will complete the paused `guest-booking-lifecycle` validation rerun so the mission has truthful, current evidence for the booking-detail and receipt assertions on the live dev runtime.

## Success Criteria

- [x] Receipt token access is preserved through the shared booking fetch path instead of being rejected as a deprecated token.
- [x] Booking-detail rebook navigation lands on a canonical booking-entry flow instead of a not-found page.
- [x] Browser-visible loading and error booking-detail states are available through a dev-only validation harness.
- [x] A dev-only guest receipt harness reuses the canonical receipt UI when the local dataset lacks historical tokenized receipt records.
- [x] Fresh user-testing artifacts and mission validation notes accurately distinguish fixed code paths from missing local seed data.

## Architecture & Components

- `reserve/features/reservations/wizard/api/useReservation.ts`: support optional tokenized entitlement for receipt fetches.
- `src/app/api/bookings/[id]/route.ts`: allow booking-scoped confirmation tokens for receipt reads without reopening deprecated public-detail token access.
- `src/app/guest/bookings/[bookingId]/receipt/*`: preserve receipt token continuity through hydration and client refetches.
- `src/components/features/booking/detail/*`: centralize loading/error surfaces so routes and dev harnesses reuse the same UI.
- `src/app/(public)/dev/booking-detail-states/page.tsx`: expose deterministic loading/error validation states.
- `src/app/(public)/dev/guest-receipt/page.tsx`: expose deterministic confirmed/pending/cancelled receipt validation states.
- `server/restaurants/getRestaurantBySlug.ts` plus booking-detail rebook logic: ensure rebook routes resolve to a public booking-entry destination in local validation.

## Data Flow & API Contracts

- `GET /api/bookings/:id?token=<token>` remains the source of truth for tokenized receipt access and now resolves booking-scoped confirmation tokens.
- Client reservation fetching must forward the same token when the receipt surface is token-entitled.
- Rebook routing should resolve to either `/restaurants/<slug>/book?...` or `/restaurants?...` as a safe fallback.
- When the connected dataset lacks historical tokenized receipt records, dev-only harness routes may hydrate the canonical receipt UI with deterministic fixture data for browser validation.

## UI/UX States

- Public booking detail:
  - Unauthenticated redirect
  - Authorized detail
  - Loading
  - Error
- Guest receipt:
  - Unauthenticated redirect
  - Tokenized confirmed receipt
  - Tokenized pending receipt
  - Tokenized cancelled receipt
  - Dev-only fixture-backed receipt preview

## Edge Cases

- Tokenized receipt page should keep working after hydration and on refetch.
- Rebook should avoid stale or unresolved restaurant slugs.
- Dev harnesses must remain dev-only and not affect production routes.

## Testing Strategy

- Unit / integration:
  - `tests/guest/public-booking-pages.test.tsx`
  - `tests/guest/guest-receipt-pages.test.tsx`
- Browser:
  - `tests/e2e/guest-public-pages.spec.ts`
  - `tests/e2e/guest-receipt-pages.spec.ts`
- Validators:
  - `npx vitest run --maxWorkers=9`
  - `pnpm typecheck`
  - `pnpm lint`
  - Chrome DevTools MCP manual QA on `http://localhost:3000`

## Rollout

- No feature flag or deployment rollout; local mission-only validation and code completion.

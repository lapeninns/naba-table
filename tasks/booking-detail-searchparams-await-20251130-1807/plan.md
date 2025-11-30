---
task: booking-detail-searchparams-await
timestamp_utc: 2025-11-30T18:07:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Booking detail searchParams error

## Objective

Ensure `/bookings/[bookingId]` loads without runtime errors by awaiting `searchParams` per Next.js 16 requirements while keeping existing token-based flows intact.

## Success Criteria

- [ ] Visiting `/bookings/:id` no longer throws the `searchParams is a Promise` error.
- [ ] Token query param is still read when present; behavior for missing token unchanged.
- [ ] Lint/type checks pass for the modified file.

## Architecture & Components

- Update server component `src/app/(public)/bookings/[bookingId]/page.tsx`.
- Introduce a resolved `searchParams` variable (awaited once) and derive `token` from it.
- Keep normalization and redirect logic unchanged.

## Data Flow & API Contracts

- No API contract changes. Query param handling remains optional; just adjusted to async resolution.

## UI/UX States

- UI states (loading/error/success) remain unchanged; only preventing runtime crash.

## Edge Cases

- Missing or whitespace bookingId -> existing redirect should still trigger.
- Absent token -> should yield `null` token as before.
- Extra search params -> ignored.

## Testing Strategy

- Run `pnpm run lint` (or targeted lint if available) to ensure no static errors.
- Manual check via Chrome DevTools MCP on `/bookings/:id` for runtime errors and basic a11y focus.

## Rollout

- Direct deploy; no flags required.
- Monitor server logs for recurring runtime errors after release.

## DB Change Plan

- Not applicable (no DB schema changes).

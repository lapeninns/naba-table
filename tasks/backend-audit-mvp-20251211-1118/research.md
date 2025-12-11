---
task: backend-audit-mvp
timestamp_utc: 2025-12-11T11:18:00Z
owner: github:@assistant
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Backend MVP audit

## Requirements

- Functional: Audit backend logic for MVP web app flows (guest booking creation/lookup, booking updates, ops bookings). Surface pitfalls/risks with rationale.
- Non-functional (a11y, perf, security, privacy, i18n): Security (auth/RLS, PII exposure), data integrity (capacity/idempotency), reliability (rate limits, retries), time zone correctness.

## Existing Patterns & Reuse

- API routes live in `src/app/api/**`; guest bookings handled in `src/app/api/bookings/*.ts`; ops/admin bookings in `src/app/api/ops/bookings/*.ts` (per route-map-ascii.txt).
- Booking domain helpers live in `server/bookings.ts` and validation pipeline in `server/booking/BookingValidationService.ts`; capacity enforcement via `createBookingWithCapacityCheck` or validation service.
- Supabase access centralised in `server/supabase.ts` (`getServiceSupabaseClient`, tenant-scoped client, default restaurant resolution).
- Rate limiting via `server/security/rate-limit.ts` (Upstash Redis preferred; in-memory fallback).
- Observability/side effects via `server/jobs/*`, `server/observability.ts`.

## External Resources

- Route map (`route-map-ascii.txt`) documents MVP routes and APIs.

## Constraints & Risks

- Service-role Supabase clients bypass RLS; correct scoping relies on code-level filters.
- Rate limiting falls back to in-memory if Upstash misconfigured (unsafe for multi-instance unless explicitly allowed).
- Default restaurant resolution depends on env/slug; misconfig breaks guest endpoints.

## Open Questions (owner, due)

- Q:
  A:

## Recommended Direction (with rationale)

- Focus audit on guest booking create/lookup, booking update/cancel, and ops booking creation since they form MVP backend flows.
- Catalog pitfalls by category (security, data integrity, reliability) with file/line references and suggested mitigations.

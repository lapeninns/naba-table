---
task: backend-audit-mvp
timestamp_utc: 2025-12-11T11:18:00Z
owner: github:@assistant
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Backend MVP audit

## Objective

We will review backend logic for the MVPs of the web app to surface pitfalls and risks.

## Success Criteria

- [ ] Clear inventory of critical backend flows and their current behavior
- [ ] Documented pitfalls with severity and suggested fixes

## Architecture & Components

- Guest booking API: `src/app/api/bookings/route.ts` (create/lookup), `src/app/api/bookings/[id]/route.ts` (update/cancel) backed by `server/bookings.ts`, `server/booking/*`, `server/capacity/*`, and Supabase clients in `server/supabase.ts`.
- Ops booking API: `src/app/api/ops/bookings/*.ts` for staff creation/management using same booking/capacity services with additional auth/roles.
- Shared infrastructure: rate limiting (`server/security/rate-limit.ts`), observability/jobs (`server/jobs/*`), default restaurant resolution (`server/supabase.ts`), feature flags (`server/feature-flags*.ts`).

## Data Flow & API Contracts

Endpoint: `POST /api/bookings` — request validated via zod, resolves restaurant, enforces capacity via RPC or fallback, triggers side-effects/auto-assign; response includes booking, confirmation token, loyalty award.
Request: booking payload {restaurantId|restaurantSlug, date, time, party, bookingType, seating, contact info}
Response: booking record + confirmationToken + bookings list; 201/200 with validation headers.
Errors: 400 (zod/operating hours), 422 (past time), 429 (rate limit), 500 (creation failure).

## UI/UX States

- N/A (backend audit)

## Edge Cases

- Missing capacity RPC -> legacy fallback path
- Past-time and operating-hour validation gated by flags
- Idempotency-key absent/malformed
- Upstash unavailable -> in-memory rate limiting

## Testing Strategy

- Review existing tests; propose additions for uncovered paths (capacity fallback, rate-limit config, past-time flag)

## Rollout

- N/A (audit)

## DB Change Plan (if applicable)

- N/A

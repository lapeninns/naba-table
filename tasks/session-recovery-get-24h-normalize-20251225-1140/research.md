---
task: session-recovery-get-24h-normalize
timestamp_utc: 2025-12-25T11:40:47Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Session Recovery GET + 24h Zoned Time Normalization

## Requirements

- Functional:
  - Refine the session recovery **GET handler** using the existing (or newly introduced) HMAC access token helpers, environment variables, observability events, and access metadata described in the session recovery notes.
  - Normalize `24:xx:xx` time inputs by converting to `00:xx:xx` on the **next day** in `zonedDateTimeToUtc` / `assertBookingNotInPast`, and add regression tests.
- Non-functional:
  - No secrets committed; env vars only.
  - Observability emits expected events without leaking sensitive data.
  - Date/time parsing is deterministic and tested.

## Existing Patterns & Reuse

- Session recovery (timeout) uses `recoverBookingAfterTimeout` and calls `fetchBookingsByContact` which hits `GET /api/bookings?email=...&phone=...&restaurantId=...` (server handler in `src/app/api/bookings/route.ts`).
- Existing security/observability patterns for public endpoints:
  - Rate limiting via `consumeRateLimit` (`server/security/rate-limit.ts`).
  - Request IP extraction + anonymization via `extractClientIp` / `anonymizeIp` (`server/security/request.ts`).
  - Observability event recording via `recordObservabilityEvent` (`server/observability.ts`).
- Booking “past time” validation and timezone conversion lives in `server/bookings/pastTimeValidation.ts`.

## External Resources

- N/A (internal behavior change; rely on existing repo patterns and tests).

## Constraints & Risks

- Risk: Token validation changes may break existing clients if metadata contracts change.
- Risk: Date normalization must preserve timezone semantics and avoid off-by-one-day errors around DST.

## Open Questions (owner, due)

- Q: Which exact endpoint is the session recovery GET handler (path + file)?
  A: `GET /api/bookings` in `src/app/api/bookings/route.ts` (contact lookup path, used by timeout recovery).
- Q: What are the canonical observability event names and required metadata keys per the notes?
  A: Implemented based on existing `guest_lookup.*` conventions in the handler: `guest_lookup.allowed`, `guest_lookup.rate_limited`, plus `guest_lookup.access_token_rejected` for access-token failures (no token/PII logged).

## Recommended Direction (with rationale)

- Implement handler refinements by following the existing helper and logging/event conventions in the codebase to keep behavior consistent and auditable.
- Implement `24:xx:xx` normalization at the parse/convert boundary (closest to string parsing) and cover with regression tests for both conversion and booking validation.

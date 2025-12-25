---
task: session-recovery-get-24h-normalize
timestamp_utc: 2025-12-25T11:40:47Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Session Recovery GET + 24h Zoned Time Normalization

## Objective

We will harden session recovery GET requests (token validation, metadata, observability) and eliminate failures caused by `24:xx:xx` time inputs by normalizing them to midnight of the next day.

## Success Criteria

- [ ] Session recovery GET handler uses HMAC access token helpers and required env vars.
- [ ] Session recovery GET handler emits the expected observability events and includes access metadata in a consistent format.
- [ ] `zonedDateTimeToUtc` accepts `24:xx:xx` and produces the same instant as next-day `00:xx:xx`.
- [ ] `assertBookingNotInPast` does not incorrectly reject valid bookings due to `24:xx:xx` normalization.
- [ ] Regression tests cover the bug and prevent future regressions.

## Architecture & Components

- Session recovery GET route/handler: `src/app/api/bookings/route.ts` (contact lookup path) with:
  - HMAC access token validation (optional) via `server/security/session-recovery-access-token.ts`.
  - Env-driven configuration via `SESSION_RECOVERY_ACCESS_TOKEN_SECRET` and `SESSION_RECOVERY_ACCESS_TOKEN_TTL_SECONDS` (wiring in `config/env.schema.ts` + `lib/env.ts`).
  - Observability events via `recordObservabilityEvent` with non-PII access metadata.
- Date/time utilities: normalize `24:xx:xx` rollover in `server/bookings/pastTimeValidation.ts` (applies to both `getCurrentTimeInTimezone` and booking parsing via `zonedDateTimeToUtc`).
- Booking validation: `assertBookingNotInPast` continues to be the single entry point for past-time checks and now accepts `24:xx:xx` inputs.

## Data Flow & API Contracts

- `GET /api/bookings` now returns `{ bookings, access }` where `access` contains only non-PII metadata (mode, lookup strategy, policy enabled, rate source, token validity).
- Observability events avoid logging raw tokens, email, or phone; only include anonymized IP and IDs where available.

## UI/UX States

- N/A (server-only and utility behavior).

## Edge Cases

- `24:00:00` and `24:59:59` normalize correctly to next day.
- Day rollover at end-of-month/year handled correctly.
- Timezones and DST transitions do not break normalization.
- Invalid times (e.g., `25:00:00`) still reject as invalid.

## Testing Strategy

- Unit tests for `zonedDateTimeToUtc` normalization behavior.
- Unit tests for `assertBookingNotInPast` with `24:xx:xx` inputs.
- Handler tests (if existing test harness for routes exists): validate event emission and metadata shape without exposing secrets.

## Rollout

- No feature flag planned unless handler behavior is a breaking change (reassess after code review).

## DB Change Plan (if applicable)

- N/A.

---
task: booking-processing-prod
timestamp_utc: 2025-11-27T00:41:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Booking processing failure (production)

## Requirements

- Functional: Booking cannot be processed in production (details TBD).
- Non-functional: Maintain data integrity; avoid double-charging or duplicate bookings; adhere to existing flows.

## Existing Patterns & Reuse

- Booking flows exist in `src/app/guest`, server APIs under `src/app/api` and `server` services; reuse existing booking service/utilities.
- Rate limiting for booking APIs uses `server/security/rate-limit.ts`, which requires Upstash Redis creds in production unless explicitly allowed to fall back to in-memory.

## External Resources

- TBD (payment/booking provider docs if applicable).

## Constraints & Risks

- Production impact; risk of revenue loss and user frustration.
- Potential payment side effects if retried; watch for duplicate submissions.
- Missing Upstash Redis credentials currently cause a hard failure in production builds (RateLimitConfigurationError) before booking logic runs.

## Open Questions (owner: self, due: ASAP)

- What exact error message/behavior is seen when processing booking?
- Which route/URL and restaurant(s) are affected?
- Are payments involved? Which method (card/cash/deposit)?
- When did it start? Any recent deploys/config changes?
- Any logs or booking IDs we can inspect?

## Recommended Direction (with rationale)

- Collect precise repro steps and error message to target the failing stage (frontend validation, API, payment, allocation).
- Review recent booking-related changes and logs once details are known.
- Introduce an opt-in flag to allow in-memory rate limiting in production when Upstash is unavailable, to restore booking flow quickly on single-instance deployments.

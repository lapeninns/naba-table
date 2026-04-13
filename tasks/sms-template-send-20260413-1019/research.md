---
task: sms-template-send
timestamp_utc: 2026-04-13T10:19:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: SMS Template Send

## Requirements

- Send the current canonical SMS templates to the supplied UK mobile number `07467586751`.
- Use the existing Twilio messaging configuration and the same template builders the product uses.

## Existing Patterns & Reuse

- Manager daily summary format is built in `lib/ops/daily-booking-summary.ts`.
- Guest booking lifecycle SMS formats are built in `server/sms/bookings.ts`.
- Twilio sending is centralized in `lib/twilio/sms.ts`.

## Constraints & Risks

- This is a live outbound SMS action and may incur cost.
- `.env.local` does not contain Twilio credentials; the production temp env bundle is needed for live sending.
- The destination number is used across multiple restaurants; use `The Old Crown Girton` as the canonical manager-summary sample because it is the one with `manager_daily_summary_enabled = true`.

## Recommended Direction (with rationale)

- Send one live manager-summary sample using the canonical formatter and real summary data for `The Old Crown Girton`.
- Send the canonical guest confirmation, update, customer-cancelled, and restaurant-cancelled templates using stable sample booking data and the same builders used in production.

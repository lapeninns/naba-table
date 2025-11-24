---
task: booking-thankyou-redirect
timestamp_utc: 2025-11-23T20:54:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking completion not redirecting to Thank You page

## Requirements

- Functional: After booking completion, user should be redirected to the Thank You/confirmation page.
- Non-functional (a11y, perf, security, privacy, i18n): Preserve existing accessibility; avoid regressions in performance; ensure no PII leaked in logs; keep UX consistent across locales.

## Existing Patterns & Reuse

- TBD after inspecting current booking flow implementation and routing.

## External Resources

- N/A yet.

## Constraints & Risks

- Potential coupling with Supabase/remote APIs; changes must not break payment/booking confirmation.
- Risk of altering navigation that affects analytics or email triggers.

## Open Questions (owner, due)

- What triggers the redirect today (client-side route push vs server redirect)? (owner: assistant, due: 2025-11-24)
- Are there feature flags governing post-booking redirect? (owner: assistant, due: 2025-11-24)

## Recommended Direction (with rationale)

- Investigate booking completion handler and thank-you route. Identify why navigation fails (missing router call, error thrown, condition not met). Plan fix with minimal surface area.

---
task: manager-summary-sms-copy
timestamp_utc: 2026-04-12T09:16:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Manager Summary SMS Copy

## Requirements

- Functional:
  - Update the daily manager booking summary SMS to the approved one-line template.
  - Include the venue name at the start of the SMS.
  - Preserve lunch and dinner breakdowns in the SMS body.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep the message concise enough to fit within a single SMS segment in common cases.
  - Avoid changing delivery infrastructure or transport behavior.

## Existing Patterns & Reuse

- `lib/ops/daily-booking-summary.ts` is the canonical formatter for manager summary SMS copy.
- `cloudflare/sms-summary-gateway/src/supabase.ts` builds the preview payload and calls the shared formatter before Twilio delivery.
- `tests/utils/dashboardSummary.test.ts` and `tests/cloudflare/sms-summary-gateway.test.ts` already verify message formatting and queue delivery behavior.

## External Resources

- None needed; this is a copy-only change within existing internal infrastructure.

## Constraints & Risks

- Venue names can be long, so copy must stay compact.
- Some restaurants may produce non-lunch/dinner bookings; if those are omitted entirely, totals could look inconsistent.

## Open Questions (owner, due)

- Q: Should non-lunch/dinner bookings appear in the SMS?
  A: Keep an optional `Other x/y.` suffix only when present so totals stay accurate without bloating the common path.

## Recommended Direction (with rationale)

- Rework the shared formatter to output: `<Venue>: Today <bkgs> bkgs, <covers> covers. Lunch <bkgs>/<covers>. Dinner <bkgs>/<covers>.`
- Thread the venue name into the formatter from the Cloudflare summary gateway.
- Update focused tests to lock the new copy in place.

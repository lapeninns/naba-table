---
task: manager-summary-sms-copy
timestamp_utc: 2026-04-12T09:16:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Manager Summary SMS Copy

## Objective

We will update the manager daily summary SMS so operators receive the approved one-line venue-prefixed message with lunch and dinner separation.

## Success Criteria

- [ ] Shared formatter emits the approved compact copy shape.
- [ ] Cloudflare summary preview includes the venue name in the generated SMS.
- [ ] Focused unit tests cover the new formatter output and queue preview content.

## Architecture & Components

- `lib/ops/daily-booking-summary.ts`: canonical summary formatter.
- `cloudflare/sms-summary-gateway/src/supabase.ts`: loads restaurant metadata and builds the preview message.
- `tests/utils/dashboardSummary.test.ts`: formatter expectations.
- `tests/cloudflare/sms-summary-gateway.test.ts`: delivery payload expectations.

## Data Flow & API Contracts

- Formatter input:
  - Summary with `serviceBreakdown`
  - `venueName`
- Formatter output:
  - Single-line SMS copy using the approved pattern.

## UI/UX States

- Not applicable; worker-side SMS content change only.

## Edge Cases

- Missing venue name falls back to `Restaurant`.
- Non-lunch/dinner bookings append `Other x/y.` only when present.

## Testing Strategy

- Unit:
  - Update formatter output assertions.
  - Update Cloudflare queue preview assertions.
- Integration:
  - None beyond existing focused test coverage.

## Rollout

- No feature flag.
- Safe to ship directly because transport and scheduling remain unchanged.

## DB Change Plan (if applicable)

- No database changes.

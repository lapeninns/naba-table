---
task: analytics-types-fix
timestamp_utc: 2025-11-27T17:50:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Analytics no-explicit-any lint fix

## Requirements

- Remove ESLint `@typescript-eslint/no-explicit-any` warnings in `lib/analytics.ts` (plausible types).
- Preserve existing analytics runtime behavior and payload shape.

## Existing Patterns & Reuse

- `AnalyticsEvent` union and `sanitizeProps` already defined in the same module.
- Events are sent via `window.plausible` if present.

## Constraints & Risks

- Must avoid runtime changes; typing only.
- Plausible options should reflect documented fields (props, url, referrer, revenue, callback).

## Open Questions

- None identified for this lint-only change.

## Recommended Direction

- Define a typed `PlausibleEventOptions` interface and use it for the `plausible` function signature on `Window`.

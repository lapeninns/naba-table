---
task: analytics-types-fix
timestamp_utc: 2025-11-27T17:50:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Analytics any cleanup

## Objective

Replace `any` usage in `lib/analytics.ts` plausible typing with a typed signature so ESLint passes without warnings.

## Success Criteria

- `@typescript-eslint/no-explicit-any` warnings in `lib/analytics.ts` are eliminated.
- Analytics tracking behavior remains unchanged.

## Steps

- Introduce `PlausibleEventOptions` describing supported fields (`props`, `url`, `referrer`, `revenue`, `callback`).
- Update `PlausibleWindow` to use `AnalyticsEvent` and the new options type instead of `any`.
- Run ESLint on the file to confirm zero warnings.

## Testing Strategy

- Targeted lint: `pnpm eslint lib/analytics.ts` (or equivalent) after the change.

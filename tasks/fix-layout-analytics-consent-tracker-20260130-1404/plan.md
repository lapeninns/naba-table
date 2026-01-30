---
task: fix-layout-analytics-consent-tracker
timestamp_utc: 2026-01-30T14:04:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Preserve static layout + bound Supabase tracker

## Objective

Keep `RootLayout` static by removing cookie access and prevent unbounded growth in Supabase N+1 tracking.

## Success Criteria

- [ ] `src/app/layout.tsx` no longer calls `cookies()`.
- [ ] Consent gating still controls Plausible/PostHog on the client.
- [ ] N+1 tracking map is bounded and prunes old entries.

## Architecture & Components

- `src/app/layout.tsx`: remove cookie read and server-side consent check.
- `src/app/providers.tsx`: add Plausible provider behind `useAnalyticsConsent`.
- `server/supabase-instrumentation.ts`: add pruning/size cap for signature map.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- Not applicable (no visible UI changes).

## Edge Cases

- Consent cookie missing on first paint → analytics disabled until client effect runs.
- High-cardinality queries → tracker prunes older entries and caps size.

## Testing Strategy

- Lint/typecheck only if needed; no new tests required.

## Rollout

- No feature flag; internal change.

## DB Change Plan (if applicable)

- Not applicable.

---
task: fix-ops-telemetry
timestamp_utc: 2026-02-04T20:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops Telemetry Gating Fixes

## Objective

Ensure Sentry Replay can re-enable after leaving ops routes and that PostHog captures early pageviews after lazy init.

## Success Criteria

- [ ] Replay integration is always registered and route-based start/stop works.
- [ ] Early PostHog pageviews are buffered and flushed after PostHog loads.
- [ ] No replay or PostHog capture on ops routes.

## Architecture & Components

- `src/instrumentation-client.ts`: route-based replay control and PostHog pageview buffering.
- `lib/posthog/provider.tsx`: flush queued PostHog events after init.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- Not applicable.

## Edge Cases

- Session starts on `/app` and then navigates to non-ops route.
- PostHog loads after initial pageview.

## Testing Strategy

- Manual sanity check: verify replay enabled state toggles with route changes.
- Confirm PostHog pageview queue flushes once loaded.

## Rollout

- No feature flags; small telemetry fix.

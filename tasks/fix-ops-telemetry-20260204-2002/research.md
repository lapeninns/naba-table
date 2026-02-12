---
task: fix-ops-telemetry
timestamp_utc: 2026-02-04T20:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ops Telemetry Gating Fixes

## Requirements

- Functional:
- Re-enable Sentry Replay when navigating from ops routes to non-ops routes in the same session.
- Preserve existing PostHog deferral while capturing early pageview events once PostHog loads.
- Non-functional (a11y, perf, security, privacy, i18n):
- No new analytics surfaces on ops routes; keep overhead minimal.

## Existing Patterns & Reuse

- `src/instrumentation-client.ts` handles Sentry + PostHog routing events.
- `lib/posthog/provider.tsx` initializes PostHog lazily.

## External Resources

- None.

## Constraints & Risks

- Avoid replay capture on ops routes while allowing re-enable elsewhere.
- Avoid adding dependencies or wrappers; keep logic in existing telemetry modules.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Always register Replay integration, then start/stop per route using existing `updateReplayForUrl`.
- Add a small PostHog event queue that flushes after initialization to avoid dropping early pageviews.

---
task: posthog-issue-noise-hardening
timestamp_utc: 2026-02-19T13:14:13Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Reduce Noisy PostHog Client Exceptions

## Requirements

- Functional:
  - Reduce known noisy PostHog exception fingerprints without disabling core exception capture.
  - Prevent the client error reporter from generating secondary unhandled fetch failures.
  - Keep existing analytics/session behavior intact for valid events.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No auth/security behavior changes.
  - No schema or API contract changes.
  - Minimal runtime overhead.

## Existing Patterns & Reuse

- Canonical PostHog bootstrap: `lib/posthog/provider.tsx`.
- Canonical client error reporter: `lib/monitoring/clientReporter.ts`.
- Global providers wiring: `src/app/providers.tsx`.

## External Resources

- `posthog-js` runtime types/source in `node_modules/posthog-js` confirms support for `before_send` and exception suppression flows.

## Constraints & Risks

- Overbroad filtering could hide actionable errors.
- Auth callback route has expected error states (expired/malformed links) that should not become noisy false alarms.
- Must keep one canonical instrumentation path and avoid wrappers/adapters.

## Findings

- Top unresolved issue: `TypeError: Failed to fetch` observed around `/auth` callback error flows.
- Current reporter uses `void fetch(...)` inside `try/catch`; async rejection can still surface as unhandled rejection.
- Secondary recurring unresolved issue: `UnhandledRejection` with `Object Not Found Matching Id:* MethodName:update, ParamCount:4`, likely non-actionable browser/SDK storage-layer noise.

## Recommended Direction (with rationale)

- Make client error reporter `fetch` explicitly rejection-safe (`.catch(...)`) to avoid self-generated telemetry errors.
- Add precise PostHog `before_send` suppression for the exact recurring non-actionable exception signature only.
- Add lightweight in-browser suppression debug state (counts + recent samples) so production debugging is possible from DevTools without reintroducing noisy telemetry.
- Add targeted tests for suppression matching logic to prevent accidental over-filtering.

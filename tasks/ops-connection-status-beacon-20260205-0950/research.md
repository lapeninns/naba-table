---
task: ops-connection-status-beacon
timestamp_utc: 2026-02-05T09:51:05Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ops Connection Status Beacon Revamp

## Requirements

- Functional: Replace inline-styled beacon with structured, accessible, Shadcn-based status pill using real realtime data.
- Non-functional (a11y, perf, security, privacy, i18n): WCAG-compliant status messaging, respect reduced motion, avoid chatty screen reader updates.

## Existing Patterns & Reuse

- `src/components/features/dashboard/ConnectionStatusBeacon.tsx` renders current beacon with inline animation.
- `src/components/features/ops-shell/patterns/OpsStatusBadge.tsx` provides Shadcn-based status badge styles.
- `lib/utils/relative-time.ts` provides relative time formatting.

## External Resources

- N/A

## Constraints & Risks

- Must keep public beacon props stable; internal wiring can expand across dashboard state + summary hook.
- Must use existing Shadcn primitives (no new base components).
- Manual UI QA via Chrome DevTools MCP required.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Use a two-row pill for clarity, map statuses via a single config object, and use shared relative time formatting for consistent output.

---
task: ops-connection-status-beacon
timestamp_utc: 2026-02-05T09:51:05Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops Dashboard Beacon Reflects Booking Realtime

## Objective

We will rebase the ops dashboard connection status beacon on booking summary freshness and summary realtime health so it reflects live booking data reliably.

## Success Criteria

- [ ] Uses Shadcn-based badge styles and no inline CSS.
- [ ] Two-row pill with live relative times updating every ~15s.
- [ ] Status reflects summary freshness; stale state accurately shown.
- [ ] Meta row shows Bookings updated / Summary updated and Sync: Realtime|Polling.
- [ ] Reduced motion respected.

## Architecture & Components

- `ConnectionStatusBeacon`: map status -> styles, format times, render pill.
- `OpsStatusBadge`: reused for status label.

## Data Flow & API Contracts

- No backend API changes. Uses `useOpsTodaySummary` realtime health plus `dataUpdatedAt` prop.

## UI/UX States

- Live, Initializing, Error, Stale (derived).

## Edge Cases

- Missing `dataUpdatedAt` hides updated times.
- Realtime unhealthy but fresh data still shows Live; Sync indicates Polling.

## Testing Strategy

- Manual UI QA (Chrome DevTools MCP) for state changes and responsiveness.
- `pnpm lint`, `pnpm typecheck` for static checks.

## Rollout

- No feature flag; direct update in primary path.

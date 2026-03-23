---
task: fix-dashboard-hydration-mismatch
timestamp_utc: 2026-03-23T16:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops dashboard hydration mismatch

## Requirements

- Functional:
  - `/dashboard` must render without React hydration error `#418`.
  - Ops dashboard content must remain interactive after hydration.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep UI accessible and keyboard-safe.
  - Keep the fix narrow with no schema or API changes.
  - Do not introduce locale-dependent SSR/client mismatches.

## Existing Patterns & Reuse

- `src/app/app/(app)/dashboard/page.tsx` server-renders the route and hydrates `OpsDashboardClient`.
- `src/components/features/dashboard/ConnectionStatusBeacon.tsx` renders relative timestamps from `Date.now()`.
- `src/components/features/dashboard/list/useBookingsListState.ts` seeds list state from `DateTime.now()`.
- `src/components/features/dashboard/cards/OpsBookingCard.tsx` renders urgency text derived from the list state timestamp.

## External Resources

- [React minified error #418](https://react.dev/errors/418) — confirms this is a hydration mismatch caused by server/client text differences.
- [React hydrateRoot mismatch guidance](https://react.dev/reference/react-dom/client/hydrateRoot#hydrating-server-rendered-html) — React expects identical initial server and client HTML.

## Constraints & Risks

- Dashboard is UI, so Chrome DevTools MCP verification is required.
- Production source maps are not available from the supplied error payload, so the root cause must be inferred from the route tree.
- Any live clock or relative-time label rendered before hydration is high risk for text mismatches.

## Open Questions (owner, due)

- Q: Is `ConnectionStatusBeacon` the only production-visible mismatch source on initial paint, or are booking urgency labels also contributing?
  A: Treat both as in-scope because both render time-dependent text in the initial tree.

## Recommended Direction (with rationale)

- Pass a server-generated `initialNowIso` snapshot from the dashboard page into client components.
- Use that snapshot for the first render in connection-status and booking-list state, then switch to live timers after mount.
- This keeps SSR and hydration deterministic while preserving live updates immediately after hydration.

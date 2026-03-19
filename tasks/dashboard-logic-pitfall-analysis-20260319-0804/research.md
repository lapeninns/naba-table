---
task: dashboard-logic-pitfall-analysis
timestamp_utc: 2026-03-19T08:04:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Dashboard logic pitfall analysis

## Requirements

- Functional:
  - Investigate the logic pitfall affecting the ops dashboard at `/dashboard`.
  - Trace the route, client state, data-fetching, and mutation flows that can produce incorrect dashboard behavior.
  - Identify the concrete failure mode, impact radius, and the safest canonical fix path.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve route auth boundaries and tenant scoping.
  - Avoid introducing request waterfalls or stale-cache regressions.
  - Keep fixes aligned with existing dashboard UX states and error handling.

## Existing Patterns & Reuse

- `src/components/features/dashboard/OpsBookingsPrintView.tsx` already guards against summary/date mismatches before printing. That pattern exposed the gap in the live dashboard route, which was still rendering placeholder summary data while query inputs had already changed.

## External Resources

- None yet. Prefer official library docs only if current implementation details require version-specific confirmation.

## Constraints & Risks

- Repo already has unrelated local modifications; analysis must avoid reverting user changes.
- Dashboard logic spans server route composition, client state hooks, query keys, and mutation invalidation, so the pitfall may be distributed rather than isolated.
- Chrome DevTools MCP is required for UI changes, but this pass starts as code/runtime analysis; if we implement a UI fix, verification evidence will need to be expanded.

## Findings

- Confirmed root cause: the live ops dashboard had two sources of truth for the active date. `selectedDate` drove query keys and mutation invalidation, while the rendered UI continued to use `summary.date` from `keepPreviousData` during refetch windows.
- Impact: after switching day or restaurant, the dashboard could continue to show stale bookings while actions and cache invalidation were already targeting the newly requested date/restaurant.
- Secondary stale-data path: table assignment routes updated booking state but did not invalidate the server-side ops summary cache, so hard refreshes and other tabs could receive stale assignment data until cache expiry.
- Secondary stale-data path: booking-detail realtime invalidation used the wrong dashboard query prefix, so some changes could miss the live dashboard summary cache.
- Additional uncovered risks remain:
  - First paint for multi-restaurant users still hydrates the first membership before client-side localStorage selection takes over.
  - Filter state accepts `completed` and `attention`, but the toolbar does not render those filters.
  - The default “today” summary can still bounce between `today` and explicit `YYYY-MM-DD` cache keys when URL state is rewritten without a `date` param.

## Open Questions (owner, due)

- Q: What exact user-visible symptom is considered the current “pitfall of logic” on `/dashboard`?
  A: Root cause confirmed from code/runtime evidence: stale placeholder dashboard data remained actionable after date or restaurant transitions. Owner: github:@amanshresthaa, due: 2026-03-19.

## Recommended Direction (with rationale)

- Guard the dashboard at the state boundary so stale placeholder summaries are treated as loading until their restaurant/date identity matches the requested state. Pair that with server cache invalidation on assignment mutations and correct dashboard invalidation prefixes for booking-detail realtime updates.

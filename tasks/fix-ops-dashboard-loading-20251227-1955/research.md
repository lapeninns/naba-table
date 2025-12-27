---
task: fix-ops-dashboard-loading
timestamp_utc: 2025-12-27T19:55:13Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops dashboard stuck in loading after summary fetch

## Requirements

- Functional:
  - Ops dashboard renders summary data on first load without requiring navigation away/back.
  - Preserve existing auth protections and per-user cache isolation.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No regressions in keyboard navigation or visual focus.
  - No data leakage across users; avoid persisting data into the wrong user cache.
  - Keep loading behavior smooth; avoid double-fetches where possible.

## Existing Patterns & Reuse

- Query state managed by React Query in `src/app/providers.tsx` (QueryLayer).
- Ops dashboard summary query: `src/hooks/ops/useOpsTodaySummary.ts` with key `lib/query/keys.ts`.
- Supabase session state: `hooks/useSupabaseSession.tsx`.

## External Resources

- None.

## Constraints & Risks

- Query cache is cleared on auth changes; must not leak data across users.
- Must not call Supabase directly in hooks unless necessary.
- UI changes require Chrome DevTools MCP QA artifacts.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Gate ops dashboard data queries until Supabase session resolves (status != loading),
  or adjust QueryLayer so initial auth hydration does not clear active queries.
  This avoids clearing the in-flight summary query that currently leaves the UI
  in a loading state until remount.

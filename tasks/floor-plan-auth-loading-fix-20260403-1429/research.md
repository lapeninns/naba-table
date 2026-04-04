---
task: floor-plan-auth-loading-fix
timestamp_utc: 2026-04-03T14:29:24Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Floor Plan Auth Reload Stability

## Requirements

- Functional:
- Keep the canonical authenticated `/floor-plan` route stable after hard reloads.
- Preserve the read-only occupancy behavior shipped in the prior mission.
- Improve the remaining floor-plan accessibility issue when it is local to the floor-plan surface.

- Non-functional (a11y, perf, security, privacy, i18n):
- Avoid broad routing or API changes.
- Keep query persistence safe across auth transitions.
- Maintain keyboard navigation and floor-plan interaction behavior.

## Existing Patterns & Reuse

- The authenticated floor plan is served through `src/app/app/(app)/floor-plan/page.tsx` and `src/components/features/seating/FloorPlanPage.tsx`.
- Client-side caching and persistence are centralized in `src/app/providers.tsx` and `lib/query/persist.ts`.
- Auth/session hydration is centralized in `hooks/useSupabaseSession.tsx`.

## External Resources

- None needed beyond the current codebase and browser evidence for this regression.

## Constraints & Risks

- The failure mode was intermittent: the route could render correctly once, then fall back to `Loading floor plan…` on hard reload.
- The floor-plan page depends on React Query, persisted query state, and Supabase auth hydration happening in the right order.
- Changes in `src/app/providers.tsx` affect more than floor-plan, so the fix must stay minimal and focused.

## Open Questions (owner, due)

- Q: Was the auth-route blocker caused by API shape drift, route rewrites, or client bootstrap?
  A: Client bootstrap. The tables API returned valid JSON and persisted query state contained successful table data, but the query layer was still clearing active queries during auth hydration.

## Recommended Direction (with rationale)

- Stabilize the React Query persistence setup so the client does not clear the query cache when auth moves from the initial anonymous/loading state to the authenticated user on reload.
- Keep the floor-plan target-size improvement local to `FloorPlanTable` so the remaining Lighthouse issue is limited to unrelated sidebar contrast, not the map surface itself.

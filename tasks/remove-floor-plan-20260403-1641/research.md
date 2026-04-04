---
task: remove-floor-plan
timestamp_utc: 2026-04-03T16:41:00Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Remove Floor Plan

## Requirements

- Functional:
- Remove the floor-plan feature from the app surface entirely.
- Remove navigation access to floor plan.
- Ensure existing floor-plan routes no longer expose the removed feature.
- Non-functional (a11y, perf, security, privacy, i18n):
- Avoid leaving dead links, broken imports, or orphaned tests.
- Keep redirects predictable for old floor-plan URLs.

## Existing Patterns & Reuse

- App navigation is centralized in `src/components/features/ops-shell/navigation.tsx`.
- Authenticated route entrypoints live under `src/app/app/(app)/**`.
- The floor-plan feature is isolated in `src/components/features/seating/FloorPlanPage.tsx` and `src/components/features/seating/floor-plan/**`.
- Dev-only harnesses exist under `src/app/(public)/dev/ops-floor-plan/**` and `src/app/(public)/__dev/ops-floor-plan/**`.

## External Resources

- None required. This is an internal feature removal and cleanup.

## Constraints & Risks

- Old deep links to `/floor-plan` and seating aliases must not strand users on broken pages.
- Removing the feature tree requires coordinated test cleanup.
- The repo has unrelated modified files in the worktree; only floor-plan removal scope should be touched.

## Open Questions (owner, due)

- Q: Where should removed floor-plan routes send users?
  A: Redirect them to `/dashboard` as the primary ops landing surface. Owner: agent. Due: implementation.

## Recommended Direction (with rationale)

- Remove the floor-plan navigation item and redirect all known floor-plan/seating route entrypoints to `/dashboard`.
- Delete the canonical floor-plan component tree, dev harnesses, and focused tests so the feature is genuinely gone rather than hidden.

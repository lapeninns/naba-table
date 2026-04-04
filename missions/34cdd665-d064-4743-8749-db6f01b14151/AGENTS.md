# Mission AGENTS.md

## Mission Boundaries (NEVER VIOLATE)

- **Canonical route only:** keep the floor-plan implementation in `src/components/features/seating/FloorPlanPage.tsx` and the existing `/floor-plan` route. Do not create alternate floor-plan pages or duplicate implementations.
- **Ports:** use port `3000` for the local Next.js app. Avoid ports `5000`, `7000`, `8317-8319`, and `54621`, which are already occupied in this environment.
- **Data boundaries:** no API, database, migration, or schema changes are allowed for this mission.
- **Behavior boundaries:** remove booking creation, assignment, and booking-navigation controls from the floor-plan surface, but preserve the existing zone/date/search/time queries, timeline semantics, route redirects, keyboard pan/zoom, and empty-search handling.

Workers: if completing the feature would require crossing these boundaries, stop and return to the orchestrator.

## Implementation Guidance

- Keep `FloorPlanPage` orchestration-only after the redesign; it should manage local UI state, selection, and composition, not route navigation side effects.
- Reuse the existing floor-plan hooks and services. Do not introduce alternate data-fetching paths.
- Keep status presentation centralized in `src/components/features/seating/floor-plan/lib/status.ts`.
- `TableInspector` must remain a passive presenter. Desktop and mobile should share the same read-only content model.
- Use existing Shadcn/UI primitives and existing styling utilities. Avoid introducing new base primitives or ad hoc status-color branches in page components.

## Testing & Validation Guidance

- Follow TDD: add failing tests before implementation changes.
- Required validators:
  - mission test command from `.factory/services.yaml`
  - mission lint command from `.factory/services.yaml`
  - `pnpm typecheck`
- Required browser validation: use `agent-browser` against `http://app.localhost:3000/floor-plan` after signing in through `http://app.localhost:3000/auth/signin` with the credentials documented in `.factory/library/user-testing.md`.
- Fallback browser validation: `http://localhost:3000/dev/ops-floor-plan` only if auth/bootstrap is blocked; document the fallback if used.
- Manual verification must cover desktop and mobile behavior, including:
  - no mutation controls or action-oriented copy
  - keyboard pan/zoom/reset
  - read-only selection details
  - mobile sheet dismissal clearing selection
  - search/zone interactions hiding stale details without leaving stale action surfaces

## Known Pre-Existing Issues (Do Not Fix)

- The repo-wide Vitest baseline currently fails in unrelated email/auth suites because `tests/server/email-queue-route.test.ts` and `tests/server/auth/magic-link-email.test.ts` cannot resolve `server-only` from `libs/resend.ts`. This mission uses the scoped floor-plan test command from `.factory/services.yaml` instead. Do not spend mission time fixing the unrelated email/auth test environment.

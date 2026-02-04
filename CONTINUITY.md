# Continuity Ledger

Last updated: 2026-02-04T20:02:00Z

## Goal (incl. success criteria)

- Fix telemetry regressions for Replay + PostHog initialization.
- Success: Replay re-enables after leaving `/app`; PostHog captures early pageviews once loaded; ops routes remain excluded.

## Constraints/Assumptions

- Follow root AGENTS policies.
- Keep changes focused; no new analytics features.
- Avoid new dependencies.

## Key decisions

- Always register Replay integration; route-gate start/stop.
- Buffer PostHog pageviews until PostHog loads.

## State

- Task created; implementation pending.

## Done

- Created task folder `tasks/fix-ops-telemetry-20260204-2002/` with SDLC stubs.

## Now

- Implement telemetry fixes in `src/instrumentation-client.ts` and `lib/posthog/provider.tsx`.

## Next

- Update `todo.md` and `verification.md`.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `src/instrumentation-client.ts`
- `lib/posthog/provider.tsx`
- `tasks/fix-ops-telemetry-20260204-2002/*`

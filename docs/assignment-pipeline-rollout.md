# Assignment Pipeline V3 — Retired

The coordinator-based assignment pipeline has been removed in favor of the legacy planner. All coordinator code paths, feature flags, and telemetry (`assignment.coordinator.*`) have been deleted.

## Current State

- Background auto-assign and inline booking flows always use the legacy planner loops.
- Env flags `FEATURE_ASSIGNMENT_PIPELINE_V3*` no longer exist; `.env.example` reflects the removal.
- Coordinator modules under `server/assignments/` and related tests have been removed.

## Operational Notes

- Expect only `auto_assign.*` and legacy planner telemetry going forward.
- Any dashboards or alerts keyed to `assignment.coordinator.*` should be archived or repointed.

## History

- Removal tracked in `tasks/remove-coordinator-20251120-2010/`.

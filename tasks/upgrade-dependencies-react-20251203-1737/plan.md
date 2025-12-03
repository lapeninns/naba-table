---
task: upgrade-dependencies-react
timestamp_utc: 2025-12-03T17:37:42Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Update dependencies (React focus)

## Objective

Upgrade React and related dependencies (Next.js, tooling, UI libs) to current stable releases while keeping the app buildable and tests passing.

## Success Criteria

- [ ] App builds with `pnpm run build`.
- [ ] React/ReactDOM updated to latest supported by Next.js; no runtime errors.
- [ ] Lint/tests pass; Storybook still builds.
- [ ] No a11y/perf regressions observed in smoke checks.

## Architecture & Components

- Dependency updates in `package.json`/`pnpm-lock.yaml`; keep `pnpm.overrides`/patches in sync.
- Verify compatibility across Next.js, React, Storybook, Vite, Tailwind, TanStack Query, Supabase SDK, BullMQ.

## Data Flow & API Contracts

- N/A (build tooling change only). Ensure API route types not broken by TypeScript/eslint upgrades.

## UI/UX States

- N/A; ensure app pages render after upgrade.

## Edge Cases

- Next.js + React version mismatch; ensure Next 16.0.7 supports React 19.2.x.
- Tailwind v4/postcss v4 interplay with Next 16 (verify PostCSS config).
- Storybook 10 migration steps (addon changes, `@storybook/testing-library` deprecation).
- BullMQ 5 breaking API/peer deps.
- eslint-plugin-react-hooks 7 and @typescript-eslint 8.48 may introduce new rule defaults; config may need updates.
- @react-email/render 2.x API differences.

## Testing Strategy

- After each batch: run `pnpm run lint` + focused tests if config changes.
- Final gate: `pnpm run lint`, `pnpm run test`, `pnpm run build`.
- If time permits: `pnpm run storybook:build` to validate Storybook upgrade.
- Manual QA via Chrome DevTools MCP on key route after build (per root policy).

## Rollout

- No feature flag; staged in repo.
- If instability, revert specific dependency or pin to previous working version; fall back to previous lockfile.

## DB Change Plan (if applicable)

- N/A (no schema changes).

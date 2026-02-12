---
task: fix-build-warnings
timestamp_utc: 2026-02-06T15:17:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix build/dev warnings

## Objective

Stop emitting avoidable build/dev warnings by making root resolution explicit and refreshing baseline mapping data.

## Success Criteria

- [ ] `pnpm run build` emits no `baseline-browser-mapping` stale-data warning.
- [ ] `pnpm run dev` emits no Next.js “workspace root inferred” warning.

## Changes

- Update `/Users/amankumarshrestha/LapenInns Project/SajiloReserveX/next.config.js`:
  - Set `turbopack.root` to an absolute path (`__dirname`) as per Next.js docs.
- Update dependencies:
  - Bump `baseline-browser-mapping` to the latest version in `devDependencies` using `pnpm`.

## Testing Strategy

- Run:
  - `pnpm run build`
  - `pnpm run dev` (smoke: ensure it starts without warnings; stop immediately after ready)

## Rollout

- No feature flag required; configuration-only change.

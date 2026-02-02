---
task: deep-repo-cleanup
timestamp_utc: 2026-02-02T02:55:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Deep repository cleanup

## Objective

We will remove additional unused artifacts/scripts/deps and update references to keep the repo lean.

## Success Criteria

- [ ] Unused scripts/artifacts removed with doc references updated.
- [ ] Additional unused deps removed and lockfile updated.
- [ ] Lint/typecheck/test/build pass.

## Architecture & Components

- No runtime architecture changes.

## Data Flow & API Contracts

- No changes.

## UI/UX States

- No UI changes expected.

## Edge Cases

- Ensure docs no longer point at deleted route map files.

## Testing Strategy

- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Rollout

- No feature flags; internal cleanup only.

## DB Change Plan (if applicable)

- None.

---
task: fix-turbopack-externals
timestamp_utc: 2026-01-24T07:46:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix Turbopack Externals Warnings

## Objective

Suppress Turbopack warnings by ensuring required externals are installed and by patching BullMQ to avoid the `ioredis/built/utils` import.

## Success Criteria

- [ ] `pnpm run build` no longer warns about import-in-the-middle/require-in-the-middle/ioredis externals.
- [ ] No changes to runtime behavior or UI output.

## Architecture & Components

- Update `package.json` dependencies to add missing externals.
- Patch BullMQ ESM build to inline `CONNECTION_CLOSED_ERROR_MSG` instead of importing from `ioredis/built/utils`.

## Testing Strategy

- Run `pnpm run build` to verify warnings are resolved.

## Rollout

- No rollout; config-only change.

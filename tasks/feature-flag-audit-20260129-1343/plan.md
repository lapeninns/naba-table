---
task: feature-flag-audit
timestamp_utc: 2026-01-29T13:43:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Feature Flag Audit Script

## Objective

Provide a robust `flags:audit` implementation that detects unused or undefined feature flag paths for server and client flags without adding runtime dependencies.

## Success Criteria

- [ ] `scripts/feature-flags/audit.ts` exists and runs via `pnpm flags:audit`.
- [ ] Script reports unused/undefined flag paths for `env.featureFlags` and `clientEnv.flags`.
- [ ] Script exits non-zero on findings by default, with a `--no-strict` opt-out.
- [ ] Validators pass (`pnpm lint`, `pnpm typecheck`, `pnpm test`).

## Architecture & Components

- **Flag definition extraction**
  - Parse `lib/env.ts` to collect leaf flag paths from `get featureFlags()`.
  - Parse `lib/env-client.ts` to collect leaf flag paths from `clientEnv.flags`.
- **Usage detection**
  - Walk TypeScript/JavaScript sources and gather `env.featureFlags.*` and `clientEnv.flags.*` property access and destructuring paths.
  - Treat container usage as usage for nested leaf paths.
- **Reporting**
  - Console output with counts and lists.
  - Optional `--json` output for CI integration.

## Data Flow & CLI Contract

- Input: repository source files; no network access.
- Output: stdout report; exit code `1` when issues found unless `--no-strict` is provided.

## Edge Cases

- Optional chaining and destructured bindings.
- Container usage (e.g., `env.featureFlags.selectorLookahead`) should mark nested flags as used.

## Testing Strategy

- Run existing validators (lint/typecheck/test).
- Optionally run `pnpm flags:audit --no-strict` to verify script output without failing the run.

## Rollout

- No runtime impact; script available for manual invocation and future CI wiring.

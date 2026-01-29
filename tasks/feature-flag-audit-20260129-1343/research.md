---
task: feature-flag-audit
timestamp_utc: 2026-01-29T13:43:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Feature Flag Audit Script

## Requirements

- Functional:
  - Implement missing `scripts/feature-flags/audit.ts` referenced by `pnpm flags:audit`.
  - Detect unused and undefined feature flag paths for server (`env.featureFlags`) and client (`clientEnv.flags`).
  - Provide readable CLI output and non-zero exit when issues are found (with an opt-out flag).
- Non-functional (a11y, perf, security, privacy, i18n):
  - No runtime impact on production; script-only tooling.
  - No new dependencies; keep scanning bounded to code files.

## Existing Patterns & Reuse

- Server feature flags mapped in `lib/env.ts` under `featureFlags`.
- Client feature flags mapped in `lib/env-client.ts` under `clientEnv.flags`.
- `flags:audit` script is already declared in `package.json` but the implementation is missing.

## External Resources

- None required.

## Constraints & Risks

- Dynamic access (e.g., indirect variables) could cause false positives; handle direct property access and destructuring.
- Exclude build outputs and large directories to keep scans fast.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Implement a TypeScript script that parses `lib/env.ts` and `lib/env-client.ts` for flag definitions, scans code for direct usage via AST, and reports unused/undefined flags. This yields a reliable, dependency-free audit aligned with existing TS tooling.

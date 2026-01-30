---
task: fix-agent-readiness-report
timestamp_utc: 2026-01-30T12:43:00Z
owner: github:@unknown
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Map each 0/1 criterion in `AGENT_READINESS_REPORT.md` to a specific change (file path + acceptance).
- [ ] Record any items that cannot be fully automated without secrets/infrastructure.

## CI / Tooling

- [ ] Enforce agent policy validation in CI (`pnpm agents:validate` and/or `node scripts/check-agents-compliance.cjs`).
- [ ] Add build/test timing summaries to CI jobs.
- [ ] Add dependency weight/bundle budget checks (Next + Vite).
- [ ] Add version drift detection (workspace package version alignment).
- [ ] Add dead feature flag detection in CI (`pnpm flags:audit`).

## Testing

- [ ] Ensure Playwright E2E tests exist and are runnable locally and in CI.
- [ ] Set non-zero Vitest coverage thresholds (start modest).
- [ ] Add test timing reporting; add a basic flake detection strategy.

## Security

- [ ] Add DAST workflow (OWASP ZAP baseline) targeting a local started server.
- [ ] Document required configuration/secrets for DAST if any.

## Dev Environment

- [ ] Add local bootstrap docs and/or docker-compose where feasible (without local Supabase).
- [ ] Make devcontainer “runnable” by documenting how to verify.

## Observability

- [ ] Add a minimal circuit breaker utility (server-side only).
- [ ] Add profiling instrumentation hooks or docs.
- [ ] Add error-to-insight automation (best-effort if tokens unavailable).

## Verification

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test:ci`
- [ ] Verify GitHub Actions YAML validity and job logic.

## Notes

- Assumptions:
- Deviations:

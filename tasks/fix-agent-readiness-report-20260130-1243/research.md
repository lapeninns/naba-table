---
task: fix-agent-readiness-report
timestamp_utc: 2026-01-30T12:43:00Z
owner: github:@unknown
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix Agent Readiness Issues

## Requirements

- Functional:
  - Address all failing (0/1) criteria called out in `AGENT_READINESS_REPORT.md`.
- Non-functional:
  - CI remains green.
  - No secrets committed; workflows must rely on repository/environment secrets.
  - Follow `/AGENTS.md` rules (task folder, Conventional Commits if committing, UI QA only if UI changes).

## Existing Patterns & Reuse

- CI workflow exists: `.github/workflows/ci.yml` includes lint/typecheck/tests/build, Playwright E2E, Lighthouse CI, secret scans, and DB drift check.
- Agent policy tooling exists:
  - `scripts/check-agents-compliance.cjs`
  - `scripts/validate-agents-md.ts` (via `pnpm agents:validate`).
- Test tooling exists:
  - `vitest.config.ts` (root) and `reserve/vitest.config.ts`.
  - `pnpm test:ci` runs coverage but thresholds are currently set to 0.
- Feature flag tooling exists: `pnpm flags:audit` (script path under `scripts/feature-flags/`).

## External Resources

- TODO: Add sources for OWASP ZAP GitHub Actions baseline scan.
- TODO: Add sources for Playwright monorepo best practices.

## Constraints & Risks

- Some readiness criteria may require repository secrets or third-party accounts (e.g., DAST target URL, Sentry automation, release tooling).
- DAST and release/deploy automation may be best-effort without access to production infrastructure.

## Open Questions (owner, due)

- Q: Should “fix all issues” include adding workflows that require new secrets/accounts (DAST target, release automation), or only changes that run without new secrets?
  A: UNCONFIRMED

## Recommended Direction (with rationale)

- Prefer implementing repo-local automation (CI checks, scripts, configs) over adding new vendor dependencies.
- For criteria requiring secrets/infrastructure, add workflows/docs with safe defaults and clear requirements so maintainers can wire secrets.

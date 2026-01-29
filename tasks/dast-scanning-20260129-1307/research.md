---
task: dast-scanning
timestamp_utc: 2026-01-29T13:07:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: DAST Scanning

## Requirements

- Functional:
  - Add a DAST scan workflow to cover dynamic security testing.
  - Run OWASP ZAP baseline scan against a running app instance.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No new runtime dependencies; use GitHub Actions only.
  - Reuse existing CI build/start patterns and secrets.

## Existing Patterns & Reuse

- `.github/workflows/ci.yml` builds and starts the app for Playwright/a11y jobs.
- Security checks already run gitleaks, trufflehog, and `pnpm audit` in CI.

## External Resources

- https://github.com/zaproxy/action-baseline (ZAP baseline GitHub Action inputs and usage).

## Constraints & Risks

- DAST scan must be able to reach the local app from the ZAP container.
- Avoid failing CI on initial findings; keep the scan report as evidence first.

## Open Questions (owner, due)

- Q: Should DAST run on every PR or on a scheduled/manual workflow?
  A: Start with scheduled + manual dispatch to avoid PR delays.

## Recommended Direction (with rationale)

- Add `.github/workflows/dast.yml` using `zaproxy/action-baseline@v0.15.0` against `http://localhost:3000` after building and starting the app.

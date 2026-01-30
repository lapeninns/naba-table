---
task: fix-ci-checks
timestamp_utc: 2026-01-30T14:36:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: CI Checks Stabilization

## Requirements

- Functional:
  - Resolve failing GitHub Actions checks in PR #31.
  - Preserve existing CI intent (security, perf, a11y, drift checks) without disabling safeguards.
  - Address Vercel preview build failure caused by missing `.next/server/middleware.js.nft.json`.
  - Fix Webpack-only CSS module print selector failure in `OpsBookingsPrintView.module.css`.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Do not weaken security scanning; update versions or add safe guards.
  - Ensure checks are deterministic in PRs without secrets.

## Existing Patterns & Reuse

- Current workflows in `.github/workflows/ci.yml` and `.github/workflows/dast.yml` already define the checks.
- E2E workflow has local fallback logic for BASE_URL; reuse that pattern if needed.

## External Resources

- GitHub Actions marketplace docs for `trufflesecurity/trufflehog` and `zaproxy/action-baseline` (version/tag validity and permissions).
- Next.js 16 docs on opting out of Turbopack via `next build --webpack` for production builds.

## Constraints & Risks

- Protected branch requires PR checks passing.
- Missing secrets in PRs should not fail jobs that depend on them; add guards.
- Avoid removing required checks; skip only when prerequisites are missing.
- Vercel build uses `npm run build`; ensure the build uses Webpack to produce middleware NFT artifacts.
- Webpack enforces CSS Modules pure selectors; print stylesheet must include a local class in selectors.

## Open Questions (owner, due)

- Q: Is Vercel check failure due to missing secrets or project config? (owner: github:@maintainers)

## Recommended Direction (with rationale)

- Update workflow steps to use valid action versions and add conditional skips when secrets/tests are missing.
- Keep security/a11y/perf checks enabled when prerequisites exist; otherwise exit gracefully.

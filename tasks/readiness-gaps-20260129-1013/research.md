---
task: readiness-gaps
timestamp_utc: 2026-01-29T10:13:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Readiness Gaps Remediation

## Requirements

- Functional:
  - Add dependency automation configuration (Dependabot) for pnpm.
  - Configure branch protection on `main` with required CI checks.
  - Add CODEOWNERS to enforce review ownership for critical paths.
  - Add a privacy policy page/docs and ensure it is reachable in the app.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Privacy policy page must meet a11y baseline and be reviewed via Chrome DevTools MCP.
  - No secrets committed; configs must be safe for public repo.

## Existing Patterns & Reuse

- CI workflows in `.github/workflows/ci.yml` and `.github/workflows/e2e.yml` define required checks.
- Next.js app router structure under `src/app` for routes.
- CODEOWNERS template guidance exists in `/AGENTS.md` (appendix).

## External Resources

- None required.

## Constraints & Risks

- Must follow SDLC task folder requirements and run validators after changes.
- Manual UI QA via Chrome DevTools MCP required for any UI page changes.
- Branch protection configuration needs correct check names (from workflows).

## Open Questions (owner, due)

- Q: Exact GitHub status check names to require for branch protection (from workflows)?
  A: CI / 🔍 Code Quality; CI / 🎭 E2E Tests (Shard 1/2); CI / 🎭 E2E Tests (Shard 2/2);
  CI / ♿ Accessibility Audit; CI / ⚡ Lighthouse Performance; CI / 🔒 Security Scans;
  CI / 🗄️ DB Drift Check

## Recommended Direction (with rationale)

- Add `.github/dependabot.yml` for npm/pnpm updates; aligns with CI and repo policy.
- Add a minimal privacy policy page in `src/app` following existing page patterns to satisfy policy gap.
- Add `.github/CODEOWNERS` using the AGENTS.md appendix to codify ownership.
- Configure branch protection via `gh` with required checks once names are confirmed.

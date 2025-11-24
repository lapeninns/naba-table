---
task: production-hardening
timestamp_utc: 2025-11-21T13:24:24Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Production Hardening – Nab a Table

## Requirements

- Functional (from sprint brief)
  - S-01: Remove and rotate leaked secrets (Supabase anon/service, DB URL/password, Resend, booking APIs); scrub repo/history; update env examples.
  - S-02: Enforce environment separation with safe defaults and runtime guardrails; document env usage.
  - S-03: Add safety/confirmation around destructive DB scripts (`db:reset`, `db:wipe`, etc.) plus tests and docs.
  - S-04: Lock down `/api/test/*` behind explicit flag/token; ensure prod disabled.
  - S-05/S-06: Stand up CI (lint/typecheck/test/build) with secret scanning + `pnpm audit`; branch protection.
  - S-07: Patch vulnerable deps (tar, prismjs, nodemailer) and verify flows.
  - S-08: Clean repo artifacts (`node_modules`, `.next`, reports, tarballs) and harden `.gitignore`.
  - S-09: Expand lint coverage beyond `server/capacity/*`; fix high-value issues.
  - S-10: Replace hot-path `console.log` with structured logging utility.
  - S-11: Update README/branding + active docs index/runbook.
  - S-12/S-13: Add migration drift checks + perf/compliance stubs (stretch).
- Non-functional
  - Security: zero secrets in git; CI secret scan/audit gates; prod safety guards on scripts/endpoints.
  - Reliability: CI coverage for lint/typecheck/build/tests; migration drift detection.
  - A11y/Perf: baseline budgets noted; Lighthouse artifacts for stretch.
  - Docs/traceability: task folder artifacts, verification evidence, Conventional Commits.

## Existing Patterns & Reuse

- Secrets/env
  - `.env.local` and `.env.example` exist and are tracked; env validation script `scripts/validate-env.ts`.
  - Secret scanning script already present: `pnpm secret:scan` uses gitleaks + trufflehog.
- CI/tests
  - No workflows under `.github/workflows/`; test scripts are stubs (`echo "tests removed"`).
  - Lint script targets only `server/capacity/{tables,telemetry,selector}.ts`.
- DB/scripts
  - `package.json` scripts `db:reset`, `db:wipe`, etc. source `.env.local` and run psql directly against `SUPABASE_DB_URL` without guardrails.
  - Supabase migrations/utilities under `supabase/utilities/*`; `scripts/verify-database.sh`, `scripts/test-connection.sh` exist.
- Logging/observability
  - Hot-path modules in `server/capacity/*` likely use raw `console.log`; no central logger observed yet.
- Docs
  - Many docs removed in working tree (git shows numerous `D` entries); README currently deleted; config branding still ShipFast (`config.ts`).

## External Resources

- Supabase remote-only requirement (per AGENTS policy); need staging/prod creds rotation guidance from platform docs.
- Gitleaks/Trufflehog patterns for secret removal; git filter-repo/BFG for history scrubbing if required.
- Dependency advisories for `tar`, `prismjs` (via `react-syntax-highlighter`), `nodemailer`.

## Constraints & Risks

- Working tree currently has many deleted files (docs, tasks); must avoid reverting unrelated changes.
- `.env.local` tracked with possible real secrets; must avoid leaking values in logs/diffs; need rotation with provider owners.
- CI absent; adding workflows must respect Conventional Commits and branch protection patterns.
- DB scripts directly hit remote Supabase; risk of unintended prod writes—guards mandatory before running any script.
- Package scripts for tests are stubs; need strategy to avoid false green CI while keeping signal.
- Node_modules and build artifacts exist in repo root; cleanup may be large diff—must ensure ignore rules to prevent re-introductions.

## Open Questions (owner, due)

- Which environments/hosts are active (Vercel/Render/GitHub Actions) to update secrets? (Owner: maintainers; Due: before rotation rollout)
- Are there separate Supabase projects for dev/staging/prod, and what are their URLs? (Owner: maintainers; Due: before env guard implementation)
- Are `/api/test/*` routes currently deployed/used in staging? Need token/allowlist expectations. (Owner: backend lead; Due: before locking routes)
- Acceptable severity threshold for `pnpm audit` gate (high/critical vs moderate)? (Owner: security; Due: before CI rollout)
- Can we rewrite git history (BFG/filter-repo) without disrupting ongoing work? (Owner: repo maintainer; Due: before force-push)

## Recommended Direction (with rationale)

- Prioritize P0 security: audit and rotate secrets, remove `.env.local` from repo, and add ignore patterns; coordinate rotations with maintainers before committing.
- Introduce env separation (`APP_ENV`/`NODE_ENV` matrix) with runtime guard that blocks dev/staging pointing to prod resources.
- Add guardrails to DB scripts with explicit env checks and TTY confirmations; add unit tests for enforcement.
- Lock `/api/test/*` behind `ENABLE_TEST_ENDPOINTS` + token gate; default off for prod.
- Stand up CI workflow for lint/typecheck/test/build plus secret scan + `pnpm audit`; fail loud when tests are stubs to avoid false confidence.
- Patch vulnerable deps and re-run audit; prefer bumping root deps or upstream packages (e.g., update `react-syntax-highlighter` to bring safe prism).
- Clean repo artifacts and harden `.gitignore`; add docs/readme refresh and logging utility replacements in hot paths.

---
task: production-hardening
timestamp_utc: 2025-11-21T13:24:24Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm environments/owners for secret rotation (Supabase, Resend, hosting, CI).
- [ ] Back up existing env values (secure note) for rotation/rollback coordination.
- [ ] Align on audit threshold for `pnpm audit` gate and branch protection requirements.

## Core Security

- [ ] Inventory secrets in repo/history; run `pnpm secret:scan` and manual `rg` sanity checks.
- [ ] Remove tracked `.env*`, add ignore patterns, and update env examples with placeholders.
- [ ] Rotate Supabase anon/service keys + DB password; rotate Resend/others; update hosting/CI.
- [ ] Add env profile guard (APP_ENV/NODE_ENV mismatch + prod resource detection).
- [ ] Guard DB scripts (`db:reset`, `db:wipe`, etc.) with env allowlist + confirmations + tests.
- [ ] Lock `/api/test/*` behind `ENABLE_TEST_ENDPOINTS` + token; add tests.

## CI / Quality

- [ ] Add `.github/workflows/ci.yml` with jobs: install, lint, typecheck, test (stub guard), build, secret scan, `pnpm audit`, optional drift check.
- [ ] Expand lint target to full codebase; adjust lint-staged/husky if needed; fix high-value issues.
- [ ] Add migration drift check script + CI job (stretch).
- [ ] Ensure `pnpm audit` and secret scan outputs are artifacts; fail on threshold.

## Repo Hygiene

- [ ] Remove committed `node_modules`, `.next`, reports, tarballs; strengthen `.gitignore`.
- [ ] Patch vulnerable deps (`tar`, `prismjs` via upstream, `nodemailer`) and update lockfile.
- [ ] Add structured logger utility; replace console logs in `server/capacity/*`.

## Docs / Runbooks

- [ ] Update `README.md` with Nab a Table branding, stack, env instructions, and run commands.
- [ ] Add `docs/environments.md` and `docs/README.md` index; mark legacy docs as deprecated.
- [ ] Document DB script usage + prod safeguards; add security/audit remediation policy.
- [ ] Record verification steps and artifacts in `verification.md`.

## Tests

- [ ] Unit tests for env guards, DB script guards, test endpoint gating, logger redaction.
- [ ] Integration tests for `/api/test/*` token/flag matrix.
- [ ] Sanity test for CI to fail if no real tests exist (until coverage improves).
- [ ] Perf/a11y/Lighthouse artifacts (stretch).

## Notes

- Assumptions: Prod/staging Supabase exist and can be rotated promptly; secret rotation approved by maintainers.
- Deviations: Will avoid history rewrite unless maintainers approve; use removal + rotation as first step.

## Batched Questions

- Preferred host/CI secret stores to update? (GitHub Actions, Vercel, etc.)
- Should CI `pnpm audit` fail on moderate or only high/critical?
- Are `/api/test/*` needed in staging, and what token distribution method is acceptable?

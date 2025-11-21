---
title: Security & Compliance Controls
description: Required security workflows for SajiloReserveX
---

# Security & Compliance Controls

## Secret rotation

1. Inventory provider keys (Supabase anon/service/DB password, Resend API key, any third-party tokens).
2. Rotate in staging first, verify health, then promote to production.
3. Update hosting + CI secrets plus `.env.example` placeholders. Never commit live values.
4. Scrub prior secrets from git history via `git filter-repo`/BFG and coordinate a force-pull with collaborators.
5. Capture evidence in `tasks/<slug>.../artifacts/secret-rotation.md`.

## CI security gates

- **Gitleaks** (`gitleaks/gitleaks-action@v2`) scans the repo on every PR push. Fails on any detected secret.
- **Trufflehog** (`trufflesecurity/trufflehog@v3`) runs in parallel to catch verified/high-signal findings.
- **`pnpm audit --prod --audit-level=high`** fails the build if production dependencies include high/critical advisories.
- Failures block merges; triage by rotating credentials (for scans) or upgrading packages (for audit).

## Migration drift detection

- Script: `pnpm db:check-drift` (wraps `supabase db dump --schema-only` and diffs against `supabase/schema.sql`).
- CI job `db-drift-check` uses `DRIFT_CHECK_DB_URL` (read-only service account) to connect remotely.
- When drift is detected:
  1. Pull the latest canonical schema (`git checkout supabase/schema.sql`).
  2. Re-run migrations against staging via Supabase CLI and regenerate `schema.sql`.
  3. Commit the refreshed schema with migration changes in the same PR.

## Local expectations

- Run `pnpm validate:env`, `pnpm lint`, `pnpm test`, and `pnpm db:check-drift` (with safe credentials) before opening a PR.
- Never bypass CI scans; if you must temporarily suppress a false positive, add the hash/commit to a gitleaks or trufflehog allowlist with justification in the task folder.

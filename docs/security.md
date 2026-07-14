---
title: Security & Compliance Controls
description: Required security workflows for Nab a Table
---

# Security & Compliance Controls

## Secret rotation

1. Inventory provider keys (Supabase anon/service/DB password, Resend API key, any third-party tokens).
2. Rotate in staging first, verify health, then promote to production.
3. Update hosting + CI secrets plus `.env.example` placeholders. Never commit live values.
4. Scrub prior secrets from git history via `git filter-repo`/BFG and coordinate a force-pull with collaborators.
5. Record the rotation in the provider or incident-management system without copying secrets.

## Migration drift detection

- Script: `pnpm db:check-drift` (wraps `supabase db dump --schema-only` and diffs against `supabase/schema.sql`).
- CI job `db-drift-check` uses `DRIFT_CHECK_DB_URL` (read-only service account) to connect remotely.
- When drift is detected:
  1. Pull the latest canonical schema (`git checkout supabase/schema.sql`).
  2. Re-run migrations against staging via Supabase CLI and regenerate `schema.sql`.
  3. Commit the refreshed schema with migration changes in the same PR.

## Local expectations

- Run `pnpm validate:env`, `pnpm lint`, and `pnpm db:check-drift` (with safe credentials) before opening a PR.
- Never bypass CI scans; document any justified false-positive suppression in the allowlist change.

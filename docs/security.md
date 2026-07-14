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
5. Capture evidence in `tasks/<slug>.../artifacts/secret-rotation.md`.

## Migration drift detection

- Link the Supabase CLI to the intended staging project, then run
  `DB_TARGET_ENV=staging pnpm db:check-drift` first.
- The safe runner validates the environment before delegating to
  `supabase db diff --linked --schema public`. Any emitted SQL is treated as drift and exits
  non-zero.
- When drift is detected:
  1. Reconcile the difference in an idempotent migration under `supabase/migrations/`.
  2. Apply the migration through `DB_TARGET_ENV=staging pnpm db:migrate`.
  3. Re-run the guarded staging drift check before promoting the migration.

## Local expectations

- Run `pnpm lint` and `DB_TARGET_ENV=staging pnpm db:check-drift` before opening a database PR;
  the database wrapper runs `pnpm validate:env` before its linked drift command.
- Never bypass CI scans; if you must temporarily suppress a false positive, add the hash/commit to a gitleaks or trufflehog allowlist with justification in the task folder.

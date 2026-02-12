---
agents_version: 5.4
scope: subproject
extends: ../AGENTS.md
last_updated: 2026-02-06
owner: github:@amanshresthaa
profile: db
---

# AGENTS.md - Supabase migrations (`supabase`)

Applies to SQL migrations under `supabase/migrations/**`.

## Rules

- Supabase is remote-only. Do not run local Supabase.
- Use `pnpm db:*` scripts or Supabase MCP for migration planning and apply.
- Staging first, then production in a change window.
- Include rollback steps and a dry-run diff in task artifacts.
- Avoid long locking migrations; prefer expand/backfill/contract.

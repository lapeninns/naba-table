---
task: sync-staging-schema-with-prod
timestamp_utc: 2026-02-07T10:26:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Sync Staging Schema With Production

## Problem Statement

Production database schema has changes not present in staging (staging is behind production).

## Current Workflow Reality

- Schema changes are often applied via Supabase SQL editor (ad-hoc), not via `supabase/migrations/*`.
- This causes drift between environments and breaks the repo's single-source-of-truth requirement.

## Decision Taken

- We will create a brand-new staging Supabase project and bootstrap it from production:
  - Copy `public` schema only (no data).
  - Seed only restaurant/config/inventory data required to run the platform without copying customers/bookings.

## Constraints

- Remote-only Supabase (no local Supabase).
- No secrets committed; credentials must live in env vars/secret stores.
- Staging-first apply.

## Risks

- Drift may include schema, RLS policies, grants, functions, and views.
- If staging already has unique changes not in prod, a naive sync could break staging.
- Applying a large diff can lock tables; must prefer safe DDL where possible.

## Evidence Collected

- Production project ref: `vrdiqfudmwydclqpydee` (nabatable, region `eu-west-2`).
- New staging project created: `ndxmivcrehsacuerwxtm` (nabatable-staging-synth, region `eu-west-2`).
- New staging `public` schema and config data were populated via Postgres dump/restore (pooler used due to transient `db.<ref>.supabase.co` DNS issues).

## Open Questions

- Resolved (2026-02-07): We are switching staging to the new project ref `ndxmivcrehsacuerwxtm`.
- Resolved (2026-02-07): Staging DB password and API keys were retrieved via Supabase CLI and stored in local env files (gitignored).

## Recommended Direction

1. Treat the production `public` schema as source of truth for this one-time staging rebuild.
2. Use the new staging project (`ndxmivcrehsacuerwxtm`) as the canonical staging environment moving forward.
3. Follow up with a separate task to enforce a migration-driven workflow (staging-first) so prod/staging cannot drift again.

---
task: sync-supabase-env
timestamp_utc: 2026-01-29T21:47:46Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Sync Supabase Env

## Objective

We will sync required Supabase env vars into `.env.local` so local builds pass validation safely.

## Success Criteria

- [ ] `NEXT_PUBLIC_SUPABASE_URL` present in `.env.local`.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` present in `.env.local`.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` present in `.env.local`.
- [ ] `pnpm run validate:env` passes.

## Architecture & Components

- No code changes; only local env provisioning.

## Data Flow & API Contracts

- CLI fetch only; no runtime API contract changes.

## UI/UX States

- N/A (no UI change).

## Edge Cases

- Vercel dev env missing Supabase URL.
- Supabase project ref not linked to intended environment.

## Testing Strategy

- Run `pnpm run validate:env` (and build if requested).

## Rollout

- Not applicable; local env change only.

## DB Change Plan (if applicable)

- Not applicable.

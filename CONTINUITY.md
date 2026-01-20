# Continuity Ledger

<<<<<<< Updated upstream
Last updated: 2026-01-20T10:10:56Z

## Goal (incl. success criteria)

- Restore public.restaurant_capacity_rules so booking RPC capacity checks no longer fail.
- Success: table exists in staging and production with expected schema/indexes.
- Success: capacity query succeeds and falls back safely when table is empty.

## Constraints/Assumptions

- Follow AGENTS SDLC phases; task folder required.
- Supabase is remote-only; staging first, then production.
- Supabase MCP still unauthorized; CLI is available.

## Key decisions

- Create a new migration to add restaurant_capacity_rules with FK constraints, nullable scope columns, indexes, and comments.
- Use gen_random_uuid(), created_at/updated_at defaults, and updated_at trigger consistent with existing tables.

## State

- Dry-run push reaches DB but fails due to local migration history missing remote versions.

## Done

- Located booking capacity query usage in `server/booking/serviceFactory.ts`.
- Identified backup references to restaurant_capacity_rules and prior capacity schema removal.
- Created task folder `tasks/fix-capacity-rules-table-20260120-0929/` with research/plan/todo/verification stubs.
- Retrieved project IDs: staging=rrpeokmfbtbrirqjprpe, production=vrdiqfudmwydclqpydee.
- Checked env: SUPABASE_ACCESS_TOKEN missing in process env; found in `.env.local`.
- User provided a Supabase access token in chat; not stored or used. Needs to be set in env.
- Staging check: public.restaurant_capacity_rules missing (42P01 relation does not exist).
- Added migration `supabase/migrations/20260120_add_restaurant_capacity_rules.sql`.
- Logged pending migration in `docs/DATABASE_MIGRATIONS.md`.
- Attempted Supabase CLI db push; blocked by DNS resolution to db.rrpeokmfbtbrirqjprpe.supabase.co.
- Dry-run db push now reaches DB but fails because remote migration versions are not present locally (migration list shows remote history ahead).

## Now

- Decide how to reconcile remote migration history vs. local migrations so db push can proceed.

## Next

- Generate dry-run diff, apply to staging, verify, then apply to production and verify.

## Open questions (UNCONFIRMED if needed)

- Should we restore missing migration files, generate stubs, or repair migration history to proceed? (UNCONFIRMED)

## Working set (files/ids/commands)

- server/booking/serviceFactory.ts
- backups/public_schema_only.sql
- supabase/migrations/
- tasks/fix-capacity-rules-table-20260120-0929/research.md
- tasks/fix-capacity-rules-table-20260120-0929/plan.md
- tasks/fix-capacity-rules-table-20260120-0929/todo.md
- # tasks/fix-capacity-rules-table-20260120-0929/verification.md
  Last updated: 2026-01-20T10:42:00Z

## Goal (incl. success criteria)

- Fix build failure caused by invalid `NODE_ENV` value during env validation.
- Success: `pnpm run build` passes env validation.

## Constraints/Assumptions

- Follow AGENTS SDLC phases and file policies.
- Avoid committing secrets.

## Key decisions

- Investigate `.env.local` and env validation rules to resolve `NODE_ENV` mismatch.

## State

- Updated `.env.local` to use `NODE_ENV=development`.

## Done

- Captured build error output from user.
- Updated `.env.local` to use valid `NODE_ENV`.

## Now

- Rerun build to confirm env validation passes.

## Next

- If build still fails, inspect next validation errors.

## Open questions (UNCONFIRMED if needed)

- Should `NODE_ENV` be `production` for build, or should validation allow `staging`? (UNCONFIRMED)

## Working set (files/ids/commands)

- .env.local
  > > > > > > > Stashed changes

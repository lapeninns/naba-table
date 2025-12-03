---
task: supabase-staging-migration
timestamp_utc: 2025-12-03T17:29:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Move app to staging Supabase (remote-only)

## Requirements

- Functional: Point all app reads/writes to the existing Supabase staging project; stop relying on any local Supabase; keep production untouched.
- Non-functional: No secrets in repo; use env vars/secret store; maintain auth/RLS parity; preserve sharing/magic links behavior while restricting mutations by auth.

### Sprint backlog alignment (2025-12-03)

1. **Credentials intake**: staging URL, anon key, service-role key, and project ref provided via secure channel (stored only in local `.env`).
2. **Env wiring**: `.env.local` should run with `APP_ENV=staging`, `NODE_ENV=development`. Deploy previews run `NODE_ENV=production` + `APP_ENV=staging` using staging keys supplied via host secrets.
3. **Env validation**: `pnpm validate:env` must succeed with staging values (no overrides required).
4. **Connectivity smoke**: `pnpm lint`, then dev server/auth smoke to prove Supabase reads succeed.
5. **Type drift check**: `supabase gen types typescript --project-ref mqtchcaavsucsdjskptc --schema public > types/supabase.ts` and commit diff (or note “no drift” if identical).
6. **Optional hardening**: evaluate staging-only auth guard for the public magic-link read path.
7. **Docs**: add staging snippet (no secrets) in README or `.env.example`, reiterate remote-only APP_ENV guidance.
8. **Verification**: record lint + smoke + typegen evidence in `verification.md` with any artifacts.

## Existing Patterns & Reuse

- Supabase clients live in `server/supabase.ts` (server/service) and `lib/supabase/browser.ts` (browser). They read env via `lib/env.ts` which expects `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and optional production overrides.
- Env validation is centralized in `config/env.schema.ts`; `APP_ENV` supports `staging`, while runtime schema selection is keyed off `NODE_ENV` (prod/development/test), so staging will typically run with `NODE_ENV=production` + `APP_ENV=staging`.
- Default restaurant context and strict hold enforcement use `env.node.appEnv` (staging treated like production for holds).
- No local Supabase tooling is present; policy already enforces remote-only DB.

## External Resources

- Supabase staging project (user-provided). Needs URL, anon key, and service-role key via env (not committed).

## Constraints & Risks

- Secrets must stay out of git; populate via `.env.local` (local) and project env vars (Vercel/host).
- Schema drift risk between current env and staging; must verify staging schema matches generated types `types/supabase` or regenerate types from staging before pointing traffic.
- RLS/auth parity: staging should mirror prod policies; magic-link viewing endpoints must remain read-only or be re-evaluated separately.
- Deployment environments must set both runtime (server) and browser vars; missing one breaks auth/session flows.
- Type generation requires either a Supabase access token or a staging Postgres connection string. Only anon/service keys were provided, so typegen may be blocked until DB credentials or a Supabase management token arrives.

## Open Questions (owner, due)

- Staging credentials: user to provide via secure channel (not stored in repo).
- Data set: is staging already populated or do we need a seed/export from current source? (user).
- Should we rotate magic-link tokens or restrict GET access as part of this change? (product/ops decision).
- Can we obtain either a Supabase access token or staging DB URL/password so that `supabase gen types` can run remotely? (maintainers, asap).

## Recommended Direction (with rationale)

- Adopt remote staging Supabase as the default non-prod target by setting env vars for that project; keep production keys separate via `PRODUCTION_SUPABASE_*` if needed.
- Validate staging schema against generated types; regenerate types from staging to avoid runtime mismatches.
- Update docs/examples (`config.example.yaml` or README) to note staging env vars and remote-only rule.
- Avoid code changes unless env wiring needs a small tweak (e.g., staging-specific safety checks); prefer configuration first.

---
task: supabase-staging-migration
timestamp_utc: 2025-12-03T17:29:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Point app to staging Supabase

## Objective

Use the existing Supabase staging project for all non-production reads/writes so local/dev environments hit remote staging (no local Supabase). Keep production isolated.

## Success Criteria

- [ ] `.env.local` (and deploy previews) run with staging Supabase keys + `APP_ENV=staging` while keeping production secrets untouched.
- [ ] `pnpm validate:env` passes with staging config and no overrides.
- [ ] `pnpm lint` + Supabase connectivity smoke succeed, demonstrating Supabase reads via staging project.
- [ ] `types/supabase.ts` is regenerated from staging (or “no drift” documented if CLI credentials are unavailable).
- [ ] README / env docs include a staging snippet (no secrets) emphasizing remote-only policy + APP_ENV usage.
- [ ] Optional: staging-only auth guard decision captured (and implemented if required).

## Architecture & Components

- Env/config: `config/env.schema.ts`, `lib/env.ts`, `.env.example` — ensure staging APP_ENV wiring is documented and validated.
- Supabase clients: `server/supabase.ts`, `lib/supabase/browser.ts` continue to consume env values (no code change expected once envs are correct).
- Tooling: `scripts/check-staging-supabase.ts` (new) to perform a non-UI smoke read using service-role key without leaking data.
- Types: `types/supabase.ts` regenerated from staging schema once CLI access token or DB URL is available.

## Data Flow & API Contracts

- Runtime Supabase URL/keys pulled from env → clients instantiated in server/browser layers → downstream services/hooks unchanged.
- No API surface changes; only backing connection target switches to staging.

## UI/UX States

- None (infra change). Verify existing auth flows still render login prompts and magic links remain read-only unless authenticated.

## Edge Cases

- Missing env vars in local/dev → fail-fast via env schema.
- APP_ENV=staging with NODE_ENV=production should still pass env schema (uses production schema). Ensure staging keys provided in that case.
- Token leakage risk if env logged—avoid logging env.

## Testing Strategy

- Env validation: `pnpm validate:env` with staging values (fail-fast on missing keys or prod leakage).
- Lint: `pnpm lint` as the fast regression check requested in the backlog.
- Connectivity: new TS script that uses the service-role key to read a single row from a low-risk table (e.g., `restaurants`) and logs a sanitized summary; optionally spot-check via dev server if time permits.
- Type drift: attempt `supabase gen types typescript --project-ref mqtchcaavsucsdjskptc --schema public > types/supabase.ts`; if blocked due to missing Supabase access token/DB password, capture the evidence and request credentials.
- Optional staging magic-link guard: add unit test coverage around the handler, gated by `APP_ENV=staging` if implemented.

## Rollout

- Configuration-first: update `.env.example`/README docs; users populate real staging values only in private env files/host secrets.
- Deploy previews: document `APP_ENV=staging` + `NODE_ENV=production` expectation so vercel-like previews point to staging.
- Feature flag: not required; if staging-only guard is added, key off `env.node.appEnv === "staging"`.
- Monitoring: rely on existing Supabase/Next logs; no new monitors yet.

## Work Breakdown

1. Pull down staging Supabase values (already provided) and update local `.env.local` (untracked) with `APP_ENV=staging`, `NODE_ENV=development`.
2. Run `pnpm validate:env` + `pnpm lint` using staged env values.
3. Create `scripts/check-staging-supabase.ts` to perform a safe connectivity smoke test; run it and store console output in task artifacts if helpful.
4. Attempt Supabase type generation; if successful, commit `types/supabase.ts`. If blocked by missing `SUPABASE_ACCESS_TOKEN`/DB URL, capture the CLI failure log and request credentials.
5. Decide on magic-link GET hardening. If required, update the route (likely `src/app/api/auth/callback` or viewer) to enforce auth when `APP_ENV=staging` and document rationale; otherwise, record decision in `verification.md`.
6. Update `.env.example` (and optionally README/docs) with a staging snippet describing `APP_ENV` usage + remote-only policy.
7. Update task `todo.md` & `verification.md`, attach lint/env/typegen evidence, and summarize results.

## Contingencies

- If Supabase CLI access is blocked (no management token or DB password), fall back to requesting credentials and note "typegen pending"; do not fabricate `types/supabase.ts` changes.
- If connectivity smoke fails, capture the Supabase error payload, validate env schema again, and coordinate with infra for firewall/RLS updates.

## DB Change Plan (if applicable)

- No schema changes planned. If types mismatch staging, regenerate `types/supabase` from staging via Supabase codegen and commit the generated file (no secrets). Attach diff artifact if done.
- No migrations executed (policy: remote-only; staging already exists).

## Next Steps

1. Collect staging env values (URL, anon key, service role key) via secure channel; set locally as env vars.
2. Validate `pnpm run lint` and env parsing with staging values.
3. Regenerate `types/supabase` from staging if needed.
4. Update documentation snippet (.env guidance) to mention staging keys and remote-only rule.
5. Summarize verification in `verification.md`.

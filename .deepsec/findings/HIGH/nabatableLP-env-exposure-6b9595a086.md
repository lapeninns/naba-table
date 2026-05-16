# [HIGH] Environment validation allows a public Supabase service-role key

**File:** [`scripts/validate-env.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/validate-env.ts#L8-L172) (lines 8, 28, 157, 172)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** medium • **Slug:** `env-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

validate-env imports envSchemas and treats schema.safeParse(process.env) as the build/dev environment gate, but the imported base schema accepts NEXT*PUBLIC_SUPABASE_SERVICE_ROLE_KEY in config/env.schema.ts. This script has no blocker before reporting validation success. NEXT_PUBLIC*\* variables are client-exposable in Next.js, and a Supabase service-role key bypasses RLS, so this misconfiguration would pass validation instead of failing closed.

## Recommendation

Remove NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY from the schema and add a validation blocker for public env names containing service-role, secret, token, password, or private key material, with an explicit allowlist for known public keys.

## Revalidation

**Verdict:** fixed

The current `config/env.schema.ts` no longer declares `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` as an accepted schema field. Although the base schema remains passthrough, `scripts/validate-env.ts` now calls `findBlockedPublicEnvKeys(process.env)` before reporting success. That helper rejects non-allowlisted `NEXT_PUBLIC_*` names containing `SERVICE_ROLE`, `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE_KEY`, or `DATABASE_URL`, and the allowlist only includes intended public values such as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The repository also has a test asserting `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` is returned as a blocked key. Git blame shows this blocker was added in `020a7389`. Therefore a public service-role env var should now fail validation instead of passing.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)

# [HIGH] Public env schema allows a Supabase service-role key

**File:** [`config/env.schema.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/config/env.schema.ts#L144) (lines 144)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** medium • **Slug:** `env-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

baseEnvSchema explicitly accepts NEXT*PUBLIC_SUPABASE_SERVICE_ROLE_KEY. NEXT_PUBLIC*\* variables are public/client-exposable in Next.js, while a Supabase service-role key bypasses RLS and grants broad database access. I did not find current code reading this public variant, but validation would pass if it were configured instead of failing closed.

## Recommendation

Remove this variable from the schema and add a validation blocker for any NEXT*PUBLIC*\* service-role or secret key. Keep service-role keys only in server-only variables such as SUPABASE_SERVICE_ROLE_KEY.

## Revalidation

**Verdict:** fixed

The explicit NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY field has been removed from baseEnvSchema. The current config defines PUBLIC_ENV_SECRET_PATTERNS including SERVICE_ROLE, SECRET, TOKEN, PASSWORD, PRIVATE_KEY, and DATABASE_URL, plus a strict NEXT_PUBLIC allowlist. findBlockedPublicEnvKeys flags NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY because it is not allowlisted and contains SERVICE_ROLE. scripts/validate-env.ts calls that blocker and exits nonzero, and package.json runs validate:env in prebuild and predev. The Zod schema remains passthrough, so schema.safeParse alone is not the complete enforcement point, but the repo’s env validation gate now fails closed for this variable. I verified the env-schema-target regression test for NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY passes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-11)

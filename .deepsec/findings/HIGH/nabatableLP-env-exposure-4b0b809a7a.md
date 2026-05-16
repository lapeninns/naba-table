# [HIGH] Supabase service-role key is allowed in public env namespace

**File:** [`config/env.schema.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/config/env.schema.ts#L144-L175) (lines 144, 175)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** medium • **Slug:** `env-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The schema explicitly accepts NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY, and the object is passthrough, so env validation will not reject a service-role key placed in the NEXT_PUBLIC namespace. In Next.js, NEXT_PUBLIC variables are treated as browser-exposed build-time configuration; if a real Supabase service-role key is configured under this name, it can be exposed to client code or build artifacts and would bypass RLS with full project privileges. I found no validate-env blocker for this public service-role variable.

## Recommendation

Remove NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY from the schema and add a validate-env blocker that rejects secret-like NEXT_PUBLIC names such as SERVICE_ROLE, SECRET, TOKEN, and PRIVATE_KEY except for an explicit safe allowlist. Keep the service role key only in SUPABASE_SERVICE_ROLE_KEY.

## Revalidation

**Verdict:** fixed

Current code no longer has NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY in the accepted env object, and I found no code reading that public variant. The new findBlockedPublicEnvKeys helper scans raw process.env for secret-looking NEXT_PUBLIC names even though the base Zod schema is passthrough. NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is specifically covered by the SERVICE_ROLE pattern and is absent from PUBLIC_ENV_ALLOWLIST. scripts/validate-env.ts turns any such key into an Environment safety checks failed blocker, and validate:env is wired into prebuild/predev. This implements the recommendation to remove the public service-role variable and add a validation blocker. The remaining caveat is that runtime env parsing does not call the blocker directly, so deployments must continue using the repository validate:env gate.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-11)

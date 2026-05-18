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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-28)

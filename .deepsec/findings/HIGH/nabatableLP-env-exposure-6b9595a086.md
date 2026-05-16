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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-28)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

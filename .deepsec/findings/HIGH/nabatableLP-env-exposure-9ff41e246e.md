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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-28)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

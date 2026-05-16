# [HIGH] Menu data file is executed in an unsafe Node VM with privileged env loaded

**File:** [`scripts/import-old-school-house-drinks-staging.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/import-old-school-house-drinks-staging.ts#L170-L1220) (lines 170, 174, 178, 195, 196, 197, 1216, 1217, 1218, 1220)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `rce`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script loads .env.local and reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and database URL values before loading SOURCE_JS_PATH and executing the file contents with vm.runInContext. SOURCE_JS_PATH is environment-controlled and defaults to a local file outside the repo. Node's vm module is not a security boundary; in this context malicious source data can escape with patterns such as window.constructor.constructor("return process")() and read service-role/database credentials or execute privileged logic under the operator process. This is not web-remote RCE, but it is a high-impact supply-chain/local-file execution path for a script that holds production-capable credentials.

## Recommendation

Do not execute the source menu file. Store the menu as JSON, or parse only a validated data literal with an AST/JSON parser that rejects functions, member expressions, constructors, and arbitrary statements. If a VM remains temporarily necessary, add a timeout and code-generation restrictions, but do not treat that as a full security boundary.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

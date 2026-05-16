# [HIGH] Menu data file is executed in an unsafe Node VM with privileged env loaded

**File:** [`scripts/import-old-school-house-drinks-staging.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/import-old-school-house-drinks-staging.ts#L170-L1220) (lines 170, 174, 178, 195, 196, 197, 1216, 1217, 1218, 1220)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `rce`

## Finding

The script loads .env.local and reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and database URL values before loading SOURCE_JS_PATH and executing the file contents with vm.runInContext. SOURCE_JS_PATH is environment-controlled and defaults to a local file outside the repo. Node's vm module is not a security boundary; in this context malicious source data can escape with patterns such as window.constructor.constructor("return process")() and read service-role/database credentials or execute privileged logic under the operator process. This is not web-remote RCE, but it is a high-impact supply-chain/local-file execution path for a script that holds production-capable credentials.

## Recommendation

Do not execute the source menu file. Store the menu as JSON, or parse only a validated data literal with an AST/JSON parser that rejects functions, member expressions, constructors, and arbitrary statements. If a VM remains temporarily necessary, add a timeout and code-generation restrictions, but do not treat that as a full security boundary.

## Revalidation

**Verdict:** fixed

The exact target path is absent from the current HEAD; `git show HEAD:scripts/import-old-school-house-drinks-staging.ts` fails because the file no longer exists. `git show --name-status 72bb7412 -- scripts/import-old-school-house-drinks-staging.ts` shows the script was deleted. I also searched the current `scripts/` tree for `vm.runInContext`, `SOURCE_JS_PATH`, and the drink-menu import RPC names and found no successor importer carrying this VM execution path. Because the script is gone, there is no current operator command at this path that can load privileged Supabase or DB environment variables and then evaluate attacker-controlled menu JavaScript. The historical issue was real in the deleted script, but it is not reachable in the current codebase.

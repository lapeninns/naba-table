# [HIGH] Unsafe JSON serialization inside email annotation script

**File:** [`server/emails/base.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/emails/base.ts#L94) (lines 94)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

renderAnnotationScript writes JSON.stringify(schema) directly into a <script type="application/ld+json"> block. Callers populate the annotation with restaurant venue fields such as name and address from the database; those fields can contain </script><script>...</script>. Because '<' is not escaped, the browser closes the script tag early and executes the injected script when this HTML is rendered in the ops email preview iframe or in any client that preserves the markup.

## Recommendation

Use a safe JSON serializer for HTML script contexts, for example JSON.stringify(value).replace(/</g, '\\u003c'), or a shared safeJsonStringify helper. Apply it before inserting annotation JSON into the script tag.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-26)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

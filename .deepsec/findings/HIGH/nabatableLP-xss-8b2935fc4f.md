# [HIGH] Unsafe JSON serialization inside email annotation script

**File:** [`server/emails/base.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/emails/base.ts#L94) (lines 94)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

renderAnnotationScript writes JSON.stringify(schema) directly into a <script type="application/ld+json"> block. Callers populate the annotation with restaurant venue fields such as name and address from the database; those fields can contain </script><script>...</script>. Because '<' is not escaped, the browser closes the script tag early and executes the injected script when this HTML is rendered in the ops email preview iframe or in any client that preserves the markup.

## Recommendation

Use a safe JSON serializer for HTML script contexts, for example JSON.stringify(value).replace(/</g, '\\u003c'), or a shared safeJsonStringify helper. Apply it before inserting annotation JSON into the script tag.

## Revalidation

**Verdict:** fixed

This specific sink has been patched in the current checkout. renderAnnotationScript builds the same Schema.org object from restaurant and booking fields, but serializes it with safeJsonForHtmlScript rather than JSON.stringify. The helper in lib/security/script-json.ts replaces < with \u003c, so the browser never sees a literal </script> delimiter inside the JSON-LD body. It also escapes >, &, and line separators, matching the recommended mitigation. I verified the caller in server/emails/bookings.ts still supplies venue.name and venue.address, so the original data flow existed, but the current sink is safe for script context. The regression test tests/lib/security/script-json.test.ts explicitly asserts that a </script><script>alert(1)</script> value does not survive as executable markup. Commit 020a7389 introduced this helper and changed the vulnerable return statement.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-26)

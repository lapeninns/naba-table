# [HIGH] Stored email template copy can break out of inline JSON-LD script

**File:** [`server/restaurants/emailTemplates.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/emailTemplates.ts#L141-L149) (lines 141, 146, 149)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This helper persists restaurant-controlled template variants directly into `restaurants.email_templates` (`params.variants` is copied into the document). The route schema only checks length/known template tokens and allows characters such as `<` and `</script>`. Those stored fields are later used as email preview data; `server/emails/base.ts` embeds annotation data with raw `JSON.stringify(schema)` inside `<script type="application/ld+json">`, and the ops preview renders `preview.html` through an unsandboxed `iframe srcDoc`. A saved CTA label such as `</script><script>top.fetch('/api/ops/...')</script>` can terminate the JSON-LD script and execute same-origin JavaScript when another restaurant member opens the email templates preview.

## Recommendation

Use a safe JSON serializer for inline script data, for example escaping `<` as `\u003c` or replacing `</` with `<\/`, and sandbox the preview iframe without `allow-same-origin`/`allow-scripts` unless required. Keep HTML escaping for visible email fields, but do not rely on it for JSON embedded in script tags.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-02)

# [HIGH] Email preview can execute template-controlled script

**File:** [`src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/preview/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/preview/route.ts#L33-L60) (lines 33, 39, 42, 60)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The preview endpoint accepts draft variants, renders them to HTML, and returns preview.html. Tracing the renderer shows ctaLabel flows into the email JSON-LD annotation, where server/emails/base.ts serializes it with raw JSON.stringify inside a <script type="application/ld+json"> tag. A value such as </script><script>parent.fetch('/api/ops/...')</script> passes the 60-character ctaLabel schema, breaks out of the JSON-LD script, and executes when the ops UI renders preview.html via an unsandboxed srcDoc iframe.

## Recommendation

Use a safe JSON serializer for inline scripts, for example JSON.stringify(schema).replace(/</g, '\u003c'), and sandbox the preview iframe without allow-scripts. Consider rejecting HTML/script delimiter characters in editable template fields as defense in depth.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-04)

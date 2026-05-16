# [HIGH] Email preview HTML can execute script through unsafe JSON-LD serialization

**File:** [`src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/preview/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/email-templates/[templateKey]/preview/route.ts#L39-L60) (lines 39, 60)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The preview route accepts draft template variants, renders them with renderRestaurantBookingEmailPreview, and returns preview.html. The template schema allows '<' and '</script>' in fields such as ctaLabel. That ctaLabel flows into server/emails/base.ts renderAnnotationScript, which embeds JSON.stringify(schema) directly inside a <script type="application/ld+json"> block. A value like </script><script>parent.fetch('/api/ops/...')</script> breaks out of the JSON-LD script. The ops UI renders this returned HTML with an unsandboxed iframe srcDoc in EmailTemplatesPreviewPane, so the injected script runs in a same-origin frame and can issue authenticated ops requests as the viewing user. Stored template variants make this exploitable against other restaurant members when they open the preview.

## Recommendation

Serialize inline JSON with a safe helper that escapes '<' such as JSON.stringify(schema).replace(/</g, '\u003c'), and sandbox the preview iframe without allow-scripts or allow-same-origin. Rejecting script delimiter characters in editable template fields would add defense in depth.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-04)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

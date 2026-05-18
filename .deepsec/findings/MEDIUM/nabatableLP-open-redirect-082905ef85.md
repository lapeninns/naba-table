# [MEDIUM] Double-slash /app paths can redirect to an attacker-controlled host

**File:** [`src/proxy.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/proxy.ts#L103-L278) (lines 103, 110, 113, 116, 174, 277, 278)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

stripLeadingAppPrefix('/app//evil.example/path') returns '//evil.example/path'. buildRedirect then passes that string to new URL(path, base); URL treats a leading double slash as a protocol-relative URL, so the Location becomes https://evil.example/path instead of the intended app/root host. This is reachable from the app-host /app stripping path and from root-host multi-host /app redirects.

## Recommendation

Normalize stripped paths so they always have exactly one leading slash and reject or encode paths beginning with // or backslash variants. Prefer constructing the redirect URL by creating the fixed-origin URL first, then assigning url.pathname and url.search separately.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-20)

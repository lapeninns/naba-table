# [BUG] includeAlternatives=false is parsed as true

**File:** [`src/app/api/availability/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/availability/route.ts#L35-L146) (lines 35, 55, 146)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The schema uses z.coerce.boolean(), and the handler supplies the string "false" when the query parameter is omitted. In Zod/JavaScript coercion, Boolean("false") is true, so omitted includeAlternatives or includeAlternatives=false enables alternative-slot searches whenever the requested slot is unavailable. That creates unexpected responses and extra database/planner work.

## Recommendation

Parse the query explicitly, for example treat only "true" or "1" as true and only "false" or "0" as false, instead of using z.coerce.boolean() for query strings.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-07)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-26)

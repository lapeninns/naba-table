# [BUG] includeAlternatives defaults to true because string false is coerced to true

**File:** [`src/app/api/availability/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/availability/route.ts#L35-L146) (lines 35, 55, 70, 146)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

rawParams supplies the literal string "false" when includeAlternatives is absent, and z.coerce.boolean() converts any non-empty string, including "false", to true. As a result, unavailable-slot requests run findAlternativeSlots even when the caller did not ask for alternatives, and ?includeAlternatives=false also enables the expensive alternative search path.

## Recommendation

Parse query booleans explicitly, for example with z.enum(["true", "false"]).transform((value) => value === "true"), and pass undefined when the parameter is absent so the schema default works as intended.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-07)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-26)

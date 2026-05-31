# [BUG] String false can be stored as marketing opt-in

**File:** [`src/app/api/bookings/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/bookings/route.ts#L32) (lines 32)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-boolean-coercion`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler delegates payload validation to the booking create schema, which uses z.coerce.boolean() for marketingOptIn. In Zod/JavaScript coercion, non-empty strings such as "false" and "0" become true, so form-style API clients can accidentally record marketing consent as enabled when the submitted value says false.

## Recommendation

Replace z.coerce.boolean() with a strict boolean schema or an explicit parser that maps only true/'true'/'1' to true and false/'false'/'0' to false.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)

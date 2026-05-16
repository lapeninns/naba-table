# [MEDIUM] Analytics helper forwards sensitive operational metadata without redaction

**File:** [`lib/analytics.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/lib/analytics.ts#L83-L128) (lines 83, 85, 119, 128)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The track() helper accepts arbitrary props, sanitizeProps() only removes null/undefined values, and the resulting payload is sent to Plausible and PostHog. The allowed event list includes ops/auth/booking events, and traced callers pass values such as booking IDs, restaurant IDs, error messages, and redirectedFrom paths. Because root layout enables Plausible globally, ops events can cross the application trust boundary even though PostHog initialization is skipped for ops hosts. If redirectedFrom contains query secrets such as OAuth codes, access tokens, or recovery tokens, or if booking/resource IDs are considered sensitive, those values are disclosed to the analytics provider.

## Recommendation

Add an allowlist/redaction layer for analytics props before dispatch. Strip or hash resource identifiers where possible, remove query strings from route/redirect fields, drop keys matching token/secret/code/authorization/cookie/email/phone, and disable third-party analytics dispatch on ops surfaces unless explicitly approved.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)

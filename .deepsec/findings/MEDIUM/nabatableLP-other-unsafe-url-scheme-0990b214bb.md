# [MEDIUM] Restaurant Google URLs are used as CTA hrefs without scheme validation

**File:** [`server/emails/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/emails/bookings.ts#L832-L835) (lines 832, 835)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-unsafe-url-scheme`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

resolveCtaUrlForTemplate returns venue.googleReviewUrl and venue.googleMapUrl directly for review and reminder email CTAs. The write-side schemas only use z.string().url(), which accepts schemes such as javascript:, data:, ftp:, and mailto:. renderButton HTML-escapes the href but does not validate the URL scheme, so a stored javascript: or data: URL can become a clickable CTA in sent email HTML and in the same-origin ops preview iframe.

## Recommendation

Validate and normalize these URLs before storage and again before rendering. For booking email CTAs, allow only http: and https: URLs, preferably restricted to expected Google Maps/review hosts for googleMapUrl/googleReviewUrl, and fall back to the safe manage URL when validation fails.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-24)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

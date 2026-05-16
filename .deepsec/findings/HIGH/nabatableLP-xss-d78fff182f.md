# [HIGH] Unsafe URL schemes can be emitted in booking email CTA links

**File:** [`server/emails/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/emails/bookings.ts#L529-L835) (lines 529, 832, 835)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `xss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

resolveCtaUrlForTemplate uses venue.googleReviewUrl and venue.googleMapUrl directly as CTA destinations, and renderHtml passes the result to renderButton. The surrounding restaurant profile validation only uses generic URL parsing, which accepts schemes such as javascript: and data:. A restaurant admin or compromised profile sync source can persist a javascript: URL; the generated preview/email then contains it as an href. In the ops preview this HTML is rendered as srcDoc in an iframe, so clicking the CTA can execute script in the app origin.

## Recommendation

Normalize CTA destinations through a server-side allowlist before rendering. Require http: or https: at minimum, and preferably restrict Google map/review links to expected Google hosts. Fall back to the safe manage URL when validation fails, and add the same protocol refinement to the restaurant URL schemas.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-24)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

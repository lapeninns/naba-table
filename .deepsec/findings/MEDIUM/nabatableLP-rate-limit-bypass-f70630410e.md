# [MEDIUM] Signup rate limit trusts spoofable IP headers

**File:** [`src/app/api/auth/signup/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/auth/signup/route.ts#L49-L85) (lines 49, 50, 51, 52, 53, 84, 85)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

buildRateLimitId builds the limiter key from x-real-ip or the first x-forwarded-for value plus the email. Scripted clients can supply matching CSRF cookie/header values and rotate these headers to create fresh buckets for the same target email, bypassing the password and magic-link attempt caps if the edge layer does not overwrite those headers before they reach the app.

## Recommendation

Derive client IP only from a trusted platform/proxy source after enforcing trusted-proxy behavior, or enforce abuse limits at the edge before user-controlled headers reach the app. Add an email-only or global signup limiter so rotating IP-derived identifiers cannot reset attempts for the same address.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

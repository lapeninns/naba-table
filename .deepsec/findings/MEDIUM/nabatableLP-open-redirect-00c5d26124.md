# [MEDIUM] Backslash-normalized next parameter bypasses local redirect check

**File:** [`src/app/(public)/bookings/recover/route.ts`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/(public)/bookings/recover/route.ts#L24-L80>) (lines 24, 27, 44, 45, 80)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

`sanitizeNextPath` only checks that `next` starts with `/` and is not a literal `//`. Because `URLSearchParams` decodes `%5C` before validation, a value like `/%5Cattacker.example/path` passes the sanitizer. `new URL(nextPath, req.nextUrl.origin)` then normalizes the backslash as a slash and produces an external URL such as `https://attacker.example/path`, which is passed to `NextResponse.redirect`. A valid recovery token is required, but an attacker can obtain one for their own booking and use the Nabatable domain as a trusted redirector for phishing or other redirect-chain abuse.

## Recommendation

Reject backslashes and encoded slash/backslash ambiguity in `next`, then validate the constructed URL before redirecting, e.g. require `redirectTarget.origin === req.nextUrl.origin` and restrict to an allowlisted set of booking paths.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-20)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

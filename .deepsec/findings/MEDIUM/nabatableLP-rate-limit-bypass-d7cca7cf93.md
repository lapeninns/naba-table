# [MEDIUM] Rate limit key can be controlled through X-Forwarded-For

**File:** [`src/app/api/availability/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/availability/route.ts#L91-L93) (lines 91, 92, 93)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The endpoint keys its rate limit on extractClientIp(req). That helper falls back to the first X-Forwarded-For value when req.ip is absent, so deployments that do not strip or overwrite client-supplied forwarding headers allow callers to rotate X-Forwarded-For and bypass the 20 requests/minute limit. This materially weakens protection for the public availability scraper surface.

## Recommendation

Derive the client IP only from a trusted platform header or edge-normalized value, and ensure incoming X-Forwarded-For is stripped/overwritten before the app. Consider adding a secondary restaurant/date scoped limiter.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-07)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-26)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

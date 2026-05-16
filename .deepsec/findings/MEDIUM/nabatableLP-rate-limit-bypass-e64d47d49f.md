# [MEDIUM] Client-controlled X-Forwarded-For is trusted for rate-limit identity

**File:** [`server/security/request.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/security/request.ts#L4-L15) (lines 4, 10, 15)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

extractClientIp() falls back to req.headers.get("x-forwarded-for") and uses the first comma-separated value without validating that the header was set by a trusted proxy. This helper feeds rate-limit identifiers in public/auth-sensitive routes such as magic-link sign-in, availability checks, booking lookup/creation, and booking confirmation. If the edge layer does not overwrite or strip client-supplied X-Forwarded-For, an attacker can rotate this header per request to create fresh rate-limit buckets and bypass abuse controls around magic-link delivery, booking lookup, and token guessing. The same pattern is also duplicated directly in the sign-in/signup route-specific rate-limit builders, so the trust boundary needs to be fixed centrally and at those call sites.

## Recommendation

Do not derive security decisions from raw X-Forwarded-For. Use a platform-provided trusted client IP value, or only consume forwarded headers after enforcing a trusted-proxy configuration that strips client-supplied values. Validate the resolved value as an IP address, prefer a fail-safe global limiter when no trusted IP is available, and update the direct sign-in/signup rate-limit builders to use the same trusted resolver.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-12)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

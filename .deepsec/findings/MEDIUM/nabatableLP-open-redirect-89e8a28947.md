# [MEDIUM] Backslash-normalized next parameter allows external redirect

**File:** [`src/app/(public)/bookings/recover/route.ts`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/(public)/bookings/recover/route.ts#L24-L87>) (lines 24, 27, 28, 45, 46, 87)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

sanitizeNextPath() only rejects values that do not start with '/' or that start with '//'. It does not reject backslashes. Because URL parsing normalizes backslashes as path separators, a decoded next value such as '/\\evil.example' (for example next=/%5Cevil.example) passes the checks at lines 24-28, then new URL(nextPath, req.nextUrl.origin) at line 46 resolves it to an external origin like https://evil.example/. After a valid recovery access token is supplied, line 87 redirects to that attacker-controlled URL. An attacker can use their own valid recovery token to create a trusted-domain phishing redirect.

## Recommendation

Reject any next value containing backslashes before constructing the URL, and enforce redirectTarget.origin === req.nextUrl.origin after construction. Prefer a shared validNextRedirect-style helper that only permits same-origin relative paths.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-20)

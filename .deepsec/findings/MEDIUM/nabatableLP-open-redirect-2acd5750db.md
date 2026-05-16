# [MEDIUM] Root layout enables weak implicit-auth redirect validation

**File:** [`src/app/layout.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/layout.tsx#L5-L72) (lines 5, 72)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

RootLayout mounts ClientLayout globally, which mounts ImplicitAuthHandler. After accepting Supabase access_token and refresh_token values from the URL fragment, that handler reads the redirectedFrom query parameter and only checks that it starts with '/' and not '// before calling router.replace. URLSearchParams decodes backslashes, so a value like redirectedFrom=/%5C%5Cevil.example becomes /\\evil.example; Next's app router resolves that with new URL(..., location.href) as https://evil.example and performs an external navigation. An attacker with valid Supabase tokens for their own account can craft a login-CSRF/open-redirect URL on the Nabatable origin that signs the victim into the attacker's session and redirects them to an attacker-controlled site.

## Recommendation

Use a shared strict redirect validator in the implicit auth handler before router.replace. Normalize with new URL(candidate, window.location.origin), require the resolved origin to equal window.location.origin or an explicit same-site allowlist, reject backslashes/control characters and encoded slash/backslash tricks, and restrict paths to expected guest/ops prefixes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-24)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

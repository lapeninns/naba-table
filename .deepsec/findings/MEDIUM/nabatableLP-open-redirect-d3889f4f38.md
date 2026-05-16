# [MEDIUM] Implicit auth handler permits backslash-based external redirects

**File:** [`src/components/layouts/EnhancedAuthLayout.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/layouts/EnhancedAuthLayout.tsx#L37) (lines 37)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

EnhancedAuthLayout mounts ImplicitAuthHandler on shipped auth layouts. That imported handler consumes Supabase access_token and refresh_token values from the URL fragment, then reads redirectedFrom from window.location.search and only checks that it starts with '/' and not '//'. URLSearchParams decodes a value such as redirectedFrom=/%5C%5Cevil.example into a slash followed by backslashes, which passes that check but is resolved by URL parsers and routers as an external navigation to https://evil.example/. Because this client handler runs on the auth layout before page-level redirect sanitizers can protect the fragment flow, an attacker with valid tokens for their own account can craft a Nabatable URL that sets the victim into the attacker's session and redirects them off-site.

## Recommendation

Fix ImplicitAuthHandler to use the same strict redirect sanitizer as the server auth callback. Reject backslashes, control characters, protocol-relative paths, and disallowed path prefixes; resolve candidates with new URL(candidate, window.location.origin) and require the resulting origin to match before router.replace.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

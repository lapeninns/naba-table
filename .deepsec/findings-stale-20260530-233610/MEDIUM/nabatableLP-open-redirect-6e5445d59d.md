# [MEDIUM] Implicit auth handler allows login CSRF with backslash open redirect

**File:** [`src/app/(public)/auth/signin/layout.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/(public)/auth/signin/layout.tsx#L4>) (lines 4)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This layout renders AuthLayout, which mounts components/auth/ImplicitAuthHandler.tsx. That handler accepts access_token and refresh_token from the URL fragment, calls supabase.auth.setSession, then reads redirectedFrom directly from window.location.search and only checks that it starts with '/' and not '//'. URLSearchParams decodes redirectedFrom=/%5C%5Cevil.example to a slash followed by backslashes, which passes that check but is interpreted by URL parsers/routers as an external URL such as https://evil.example. The page-level redirect sanitizer does not mitigate this because the handler reads the raw browser URL directly. An attacker with valid Supabase tokens for their own account can craft a Nabatable URL that signs a victim into the attacker's session and then redirects them off-site.

## Recommendation

Remove the legacy implicit-fragment flow if the app now uses the server token_hash callback, or require an auth state/nonce bound to a SameSite cookie before accepting fragment tokens. Validate redirectedFrom with a shared sanitizer that rejects backslashes, encoded slash/backslash variants, control characters, and anything whose resolved URL is not same-origin and on an allowed path.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-24)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-04)

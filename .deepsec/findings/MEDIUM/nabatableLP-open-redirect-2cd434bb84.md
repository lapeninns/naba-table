# [MEDIUM] Implicit auth handler allows login CSRF with backslash open redirect

**File:** [`src/app/app/auth/signin/layout.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/auth/signin/layout.tsx#L5) (lines 5)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

This layout renders EnhancedAuthLayout, which mounts components/auth/ImplicitAuthHandler.tsx. That handler accepts access_token and refresh_token from the URL fragment, calls supabase.auth.setSession, then reads redirectedFrom directly from window.location.search and only checks that it starts with '/' and not '//'. URLSearchParams decodes redirectedFrom=/%5C%5Cevil.example to a slash followed by backslashes, which passes that check but is interpreted by URL parsers/routers as an external URL such as https://evil.example. The Ops sign-in page's resolveRedirectTarget check does not mitigate this because the handler reads the raw browser URL directly. An attacker with valid Supabase tokens for their own account can craft a Nabatable URL that signs a victim into the attacker's session and then redirects them off-site.

## Recommendation

Remove the legacy implicit-fragment flow if the app now uses the server token_hash callback, or require an auth state/nonce bound to a SameSite cookie before accepting fragment tokens. Validate redirectedFrom with a shared sanitizer that rejects backslashes, encoded slash/backslash variants, control characters, and anything whose resolved URL is not same-origin and on an allowed path.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-04)

# [MEDIUM] redirectedFrom permits backslash-based external redirects

**File:** [`components/auth/ImplicitAuthHandler.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/components/auth/ImplicitAuthHandler.tsx#L105-L120) (lines 105, 106, 108, 110, 111, 120)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

After setting a session, the handler accepts redirectedFrom when it starts with '/' and not '//', then passes it directly to router.replace. URLSearchParams decodes encoded backslashes, so a value such as redirectedFrom=/%5C%5Cevil.example becomes /\\evil.example, passes the current check, and is resolved by URL parsing as https://evil.example/. Combined with attacker-supplied valid Supabase tokens in the fragment, this gives an exploitable login-CSRF plus external redirect phishing path.

## Recommendation

Use a shared strict redirect validator before router.replace: reject backslashes, control characters, and encoded slash/backslash tricks; normalize with new URL(candidate, window.location.origin); require the resolved origin to be same-origin or explicitly allowlisted; and restrict paths to expected guest/ops prefixes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)

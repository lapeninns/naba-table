# [MEDIUM] Sign-out endpoint mutates session cookies without CSRF validation

**File:** [`src/app/api/auth/signout/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/auth/signout/route.ts#L53-L98) (lines 53, 80, 91, 98)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The POST handler accepts any request, builds a cookie-bound Supabase client, calls auth.signOut(), and explicitly expires all sb-\* auth cookies. Unlike the signin and signup handlers, it never calls validateCsrfToken. A malicious same-site subdomain, or a cross-site form in browser/deployment cases where cookies are sent, can force a victim's session to be cleared. SameSite=Lax reduces some cross-site cases but is not the repo's CSRF control for session-cookie POST handlers.

## Recommendation

Require validateCsrfToken(req) before signing out or expiring cookies, and update signOutFromSupabase to send the x-csrf-token header via the shared CSRF helper or fetchJson. Consider an Origin/Referer fallback for any non-JavaScript signout path.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-27)

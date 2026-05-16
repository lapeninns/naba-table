# [MEDIUM] Implicit hash tokens are accepted without state binding

**File:** [`components/auth/ImplicitAuthHandler.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/components/auth/ImplicitAuthHandler.tsx#L33-L120) (lines 33, 36, 70, 71, 72, 85, 86, 87, 105, 110, 120)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-login-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler is mounted globally and treats any URL fragment containing access_token as an auth response. It reads access_token and refresh_token directly from window.location.hash and calls supabase.auth.setSession without checking a stored state/nonce, expected callback path, or that this browser initiated the flow. An attacker with valid tokens for their own account can send a victim a Nabatable URL containing those tokens in the fragment; the victim browser installs the attacker-controlled session and then follows an internal redirectedFrom path. This is login CSRF/session fixation and can cause actions or PII entered by the victim to be associated with the attacker's account.

## Recommendation

Prefer the server-side token_hash callback flow and remove global implicit token handling if possible. If implicit handling is still required, restrict it to a dedicated callback route, require a state/nonce stored before login, validate that state before setSession, and clear the hash before any async work.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)

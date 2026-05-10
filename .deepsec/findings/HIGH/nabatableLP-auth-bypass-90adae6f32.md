# [HIGH] Magic-link token can be sent to an attacker-controlled callback origin

**File:** [`server/auth/magic-link-email.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/auth/magic-link-email.ts#L21-L235) (lines 21, 81, 83, 84, 205, 207, 221, 222, 235)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `auth-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

sendAuthMagicLink trusts the caller-supplied emailRedirectTo, passes it to Supabase admin.generateLink, then builds the delivered email URL by appending token_hash and type=magiclink to that same URL. The signin caller derives emailRedirectTo from request host/origin style headers and accepts hostnames ending with nabatable.com, so domains such as evilnabatable.com can pass that check if supplied via a trusted-by-code header path. The delivered email would contain a legitimate Supabase token_hash in a link to the attacker-controlled origin. The app callback redeems token_hash directly with verifyOtp, so a captured token hash can be replayed to create a victim session.

## Recommendation

Validate emailRedirectTo inside sendAuthMagicLink against exact configured HTTPS callback origins before calling generateLink or sending email. Do not derive auth callback origins from Origin/Referer/forwarded headers; prefer configured canonical app/root URLs. Fix caller host checks to require exact allowed hosts or a real subdomain boundary, and add regression tests for forged Origin/X-Forwarded-Host and evilnabatable.com-style suffixes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-23)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

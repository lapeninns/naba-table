# [MEDIUM] Signup reveals whether an email is already registered

**File:** [`src/app/api/auth/signup/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/auth/signup/route.ts#L103-L133) (lines 103, 104, 128, 129, 132, 133)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-user-enumeration`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The public password signup endpoint maps Supabase existing-account errors to a distinct 409 ACCOUNT_EXISTS response with the message 'An account already exists for this email.' The rate-limit key includes the email address, so an attacker can enumerate many addresses by changing the email value; CSRF does not prevent direct scripted requests to this public endpoint.

## Recommendation

Return a uniform response for new and existing emails, such as a generic 'check your email' message, and move account-exists guidance to an email-only side channel. Add an IP/global signup throttle that is independent of the probed email address.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

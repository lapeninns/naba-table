# [MEDIUM] Webhook reads full unauthenticated body before cheap rejection

**File:** [`src/app/api/webhook/resend/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/webhook/resend/route.ts#L51-L61) (lines 51, 52, 56, 61)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-dos`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The Resend webhook calls req.text() before checking whether required Svix headers are present. An unauthenticated attacker can send large requests without verification headers and still force the server to buffer the body before returning 401. Requests with bogus headers also reach signature verification, and there is no local body-size or rate-limit guard in this handler.

## Recommendation

Check required signature headers and a strict Content-Length limit before reading the body, reject oversized requests, and add rate limiting for failed webhook verification attempts.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-26)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

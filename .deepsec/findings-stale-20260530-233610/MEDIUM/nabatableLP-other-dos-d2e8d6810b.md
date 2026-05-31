# [MEDIUM] Webhook body limit can be bypassed when Content-Length is missing or understated

**File:** [`src/app/api/webhook/resend/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/webhook/resend/route.ts#L67-L78) (lines 67, 72, 73, 78)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-dos`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler rejects oversized requests only when Content-Length is present and greater than 256 KiB. If the header is absent or understated, the public webhook still calls req.text(), buffering the entire request body before checking the actual byte length. An attacker with bogus Svix headers can send large chunked or misleading requests to consume memory before the size check or signature verification runs.

## Recommendation

Enforce the size limit before buffering the full body, for example by streaming the request and aborting once the cap is exceeded, rejecting missing Content-Length at the edge, or configuring an upstream hard body limit. Add rate limiting for failed webhook verification attempts.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)

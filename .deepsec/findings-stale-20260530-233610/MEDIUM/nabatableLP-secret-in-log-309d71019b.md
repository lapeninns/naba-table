# [MEDIUM] Logger redaction misses secret tokens embedded in URL path segments

**File:** [`lib/logger.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/lib/logger.ts#L107-L214) (lines 107, 109, 173, 214)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secret-in-log`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The logger redacts sensitive metadata keys, query parameters, emails, phones, and loose key=value tokens, but sanitizeString() does not redact secret tokens carried as path segments. The global client error endpoint logs the client-supplied path field via this logger; because public invitation links are /invite/[token], any client error on an invitation page can persist the invitation token in server logs.

## Recommendation

Extend the shared redaction layer to normalize sensitive route patterns before serialization, for example /invite/<token> -> /invite/[redacted] and /api/team/invitations/<token> -> /api/team/invitations/[redacted]. Add regression tests for path-segment secrets, not only query-string secrets.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-21)

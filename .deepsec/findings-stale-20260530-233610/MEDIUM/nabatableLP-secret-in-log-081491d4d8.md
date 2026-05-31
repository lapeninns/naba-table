# [MEDIUM] Structured sensitive metadata bypasses logger redaction

**File:** [`lib/logger.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/lib/logger.ts#L75-L100) (lines 75, 76, 81, 87, 96, 100)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secret-in-log`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The logger only checks shouldRedact() after handling Error, object, and array values. As a result, metadata such as { token: { value: "secret" } }, { authorization: ["Bearer secret"] }, or { apiKey: new Error("secret") } is serialized instead of redacted because the sensitive parent key is ignored once the value is an object, array, or Error. Any request path that relies on this central logger to redact structured credentials, headers, cookies, tokens, or secret-bearing errors can leak those values into application logs.

## Recommendation

Check shouldRedact(key, redactKeys) before special-casing Error, arrays, or objects, and redact the entire value when the current key is sensitive. Consider adding tests for string, object, array, and Error values under password/secret/token/key/authorization/cookie/email/phone keys.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-21)

# [MEDIUM] QA text redaction misses common secret environment assignments

**File:** [`scripts/qa/redaction.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/qa/redaction.ts#L87-L117) (lines 87, 94, 117)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secret-in-log`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The structured-object redactor uses broad sensitive-key matching, but free-form text redaction only handles a narrow set of exact assignment names such as access_token, api_key, password, secret, session, and token. QA artifact sanitization and RC summaries call redactQaText on logs and text artifacts, so dumped environment/config lines like SUPABASE_SERVICE_ROLE_KEY=..., TWILIO_AUTH_TOKEN=..., STRIPE_SECRET_KEY=..., or non-HTTP credential URLs can survive sanitization. I confirmed redactQaText('SUPABASE_SERVICE_ROLE_KEY=service-secret') returns the secret unchanged. If sanitized QA artifacts or summaries are uploaded from CI, a failing command that prints env/config can expose service credentials.

## Recommendation

Use the existing isSensitiveKey substring matcher for KEY=value-style assignments instead of the narrow hard-coded assignment regex, redact common credential URL schemes and userinfo, and add regression tests for SUPABASE_SERVICE_ROLE_KEY, TWILIO_AUTH_TOKEN, DATABASE_URL, REDIS_URL, and provider secret keys.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)

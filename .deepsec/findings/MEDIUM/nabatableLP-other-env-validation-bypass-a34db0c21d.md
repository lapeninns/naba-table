# [MEDIUM] Dual-sync webhook URL bypasses the validated environment layer

**File:** [`server/dual-sync/notifications/index.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/notifications/index.ts#L55-L76) (lines 55, 70, 72, 75, 76)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-env-validation-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

buildDefaultNotificationPort reads DUAL_SYNC_FAILURE_WEBHOOK_URL directly from process.env and posts dual-sync failure payloads to that URL. This bypasses the project's typed env layer and staging/production resource separation checks, and the variable is not declared in config/env.schema.ts. A mis-scoped or injected deployment variable can silently route tenant failure metadata, restaurant IDs, publish job IDs, and raw error messages to an unintended external endpoint.

## Recommendation

Add DUAL_SYNC_FAILURE_WEBHOOK_URL to the env schema with URL validation, expose it through @/lib/env, and use that getter here. Consider enforcing https and an allowlist for notification destinations, and fail closed or log configuration errors when the value is invalid.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)

**Verdict:** fixed

Dual-sync failure notification webhooks now use the validated `env.dualSync.failureWebhookUrl` path, with schema-level HTTPS enforcement before webhook construction.

**Verification:** `pnpm exec vitest run tests/server/deepsec-final-controls-source.test.ts`

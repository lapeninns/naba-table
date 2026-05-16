# [MEDIUM] Dual-sync failure webhook bypasses the validated env layer

**File:** [`server/dual-sync/notifications/index.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/notifications/index.ts#L70-L75) (lines 70, 75)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-env-validation-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

buildDefaultNotificationPort reads DUAL_SYNC_FAILURE_WEBHOOK_URL directly from process.env and, when present, passes it straight into createWebhookNotificationPort. That webhook transport POSTs the full DualSyncNotificationEvent JSON to the configured URL, including restaurantId, publishJobId, raw errorMessage values, counts, and metadata from tenant auto-export/refresh failures. The variable is not declared in config/env.schema.ts and is not exposed through lib/env, so it bypasses the project's typed env validation and staging/production resource-separation checks. A mis-scoped or injected deployment variable can silently route tenant operational metadata to an unintended external endpoint.

## Recommendation

Declare DUAL_SYNC_FAILURE_WEBHOOK_URL in config/env.schema.ts with URL validation, expose it through @/lib/env, and read it from that typed getter. Prefer enforcing https and, if possible, an allowlist of notification destinations; treat invalid webhook configuration as disabled with an explicit operator warning.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)

**Verdict:** fixed

`DUAL_SYNC_FAILURE_WEBHOOK_URL` is now declared in the env schema with HTTPS URL validation, exposed through `env.dualSync.failureWebhookUrl`, and consumed from that typed getter instead of `process.env`.

**Verification:** `pnpm exec vitest run tests/server/deepsec-final-controls-source.test.ts`

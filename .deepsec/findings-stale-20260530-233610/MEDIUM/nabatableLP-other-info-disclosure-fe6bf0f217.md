# [MEDIUM] Service-role smoke script can disclose production email recipient data without a staging guard

**File:** [`scripts/staging/smoke-email-delivery-rpc.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/staging/smoke-email-delivery-rpc.ts#L33-L78) (lines 33, 34, 36, 40, 48, 60, 77, 78)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

This staging smoke script loads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, creates a service-role Supabase client, queries the email delivery summary/feed RPCs, and logs a sample recipientEmail. Unlike the other staging scripts, it does not call assertStagingScriptSafety or require a staging confirmation before using the service-role key. If the environment points at production, the script reads production email delivery data and prints recipient PII into local or CI logs.

## Recommendation

Add assertStagingScriptSafety before creating the service-role client, use a staging-specific expected project ref, require an explicit confirmation for service-role reads, and mask recipient emails in smoke output.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)

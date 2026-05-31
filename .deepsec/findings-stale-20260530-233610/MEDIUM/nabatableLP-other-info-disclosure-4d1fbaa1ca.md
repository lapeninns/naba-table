# [MEDIUM] SMS backfill artifacts expose customer phone numbers and booking identifiers

**File:** [`scripts/backfill-sms-delivery.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/backfill-sms-delivery.ts#L104-L356) (lines 104, 278, 287, 332, 336, 343, 346, 356)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script writes backfill samples to tasks/sms-delivery-observability-20260413-1249/artifacts with raw Twilio recipient phone numbers plus message SIDs, booking IDs, restaurant IDs, and booking references. Existing files in that artifact directory are tracked in git, so production dry-run/apply artifacts can leak customer PII and booking metadata into source control. The repo already has phone redaction utilities, but they are not used here.

## Recommendation

Redact or hash recipient phones, omit booking references and internal IDs unless strictly needed, run artifact sanitizer before writing, and ensure generated production artifacts are untracked or written outside the repo.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-13)

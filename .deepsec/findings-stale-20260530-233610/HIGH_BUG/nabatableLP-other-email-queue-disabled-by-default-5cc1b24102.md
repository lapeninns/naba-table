# [HIGH_BUG] Durable email queue defaults off despite fail-safe comment

**File:** [`server/feature-flags.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/feature-flags.ts#L189-L220) (lines 189, 190, 192, 202, 205, 220)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-email-queue-disabled-by-default`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

isEmailQueueEnabled() is written as if an unset FEATURE_EMAIL_QUEUE_ENABLED value should default to true outside tests, but it reads env.featureFlags.emailQueueEnabled, which lib/env normalizes to a boolean with parsed.FEATURE_EMAIL_QUEUE_ENABLED ?? false. That makes configured always boolean, so the intended safe default branch is unreachable. In production with the flag unset, long-delay reminder/review emails fall back to unreliable inline setTimeout scheduling.

## Recommendation

Preserve a raw tri-state FEATURE_EMAIL_QUEUE_ENABLED value or read the parsed env before defaulting. Default to true in production and require an explicit audited override to disable the durable queue.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-20)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

# [MEDIUM] Public lead-capture write endpoint has no abuse protection

**File:** [`src/app/api/lead/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/lead/route.ts#L27-L36) (lines 27, 28, 36)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The unauthenticated POST handler parses attacker-controlled JSON and writes directly to the leads table without any rate limit, captcha, or size/format constraints. A bot can repeatedly submit arbitrary email strings to poison the lead list and consume database/API capacity. Other public write endpoints in this repo use consumeRateLimit, but this route does not.

## Recommendation

Apply consumeRateLimit using a stable client identifier, validate and cap email length, and consider Turnstile or equivalent bot protection for public lead capture.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

# [MEDIUM] Unauthenticated client error endpoint can be abused for log flooding

**File:** [`src/app/api/client-error/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/client-error/route.ts#L5-L13) (lines 5, 7, 8, 9, 10, 11, 12, 13)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The public POST handler accepts arbitrary unauthenticated JSON and immediately writes attacker-controlled fields, including message, stack, path, userId, and bookingId, to server logs. Although unauthenticated client error collection is intentional for this route, there is no rate limiting, request size enforcement, schema validation, field truncation, or spoofing protection before logging. An attacker can repeatedly submit large or misleading payloads to inflate log volume/costs, obscure real operational signals, and inject forged user or booking identifiers into incident/debug logs.

## Recommendation

Add IP or fingerprint-based rate limiting, enforce a small maximum request body size, validate the payload shape, truncate high-volume fields such as stack/message/path, and avoid logging userId or bookingId from an unauthenticated client unless they are clearly marked as untrusted client claims.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-05)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.

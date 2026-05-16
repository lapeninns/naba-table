# [MEDIUM] Global client error reporting can leak tokenized booking URLs

**File:** [`src/app/providers.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/providers.tsx#L50) (lines 50)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `secret-in-log`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The provider mounts useClientErrorReporter globally. That imported hook records window.location.pathname + window.location.search for both client errors and unhandled rejections, sends it to /api/client-error, and also forwards it into analytics events. This app has legitimate token-bearing URLs such as guest booking/receipt flows that accept query parameters like token and access_token. If a client-side error or rejection occurs while one of those URLs is loaded, the booking access credential can be written to server logs and third-party telemetry, where anyone with log/analytics access could reuse it to view or manage the booking.

## Recommendation

Do not report raw query strings. Redact or drop sensitive parameters such as token, access_token, accessToken, refresh_token, code, and redirectedFrom before logging or sending analytics, and prefer clearing tokenized URLs before any client-rendered app shell can run.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-04)

**Verdict:** fixed

Client-side monitoring and analytics paths now pass browser location values through `stripUrlQueryAndHash`, and ops/app surfaces are suppressed from third-party analytics dispatch. Query-string secrets such as reset, access, and onboarding tokens are no longer emitted through the reported analytics/error path fields.

Validation: `pnpm exec vitest run tests/scripts/db-safety.test.ts tests/lib/logger-redaction.test.ts tests/lib/analytics-schema.test.ts tests/lib/analytics.test.ts`

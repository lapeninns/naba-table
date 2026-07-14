# Task 3 evidence: purpose-scoped WhatsApp review links

Date: 2026-07-12
Spec: `MS-integrations-review-link-redirect`
Mode: local-only; no remote Worker, D1, KV, Google, or production mutation

## Baseline and TDD receipt

- Baseline booking-link characterization: 3 files, 9 tests passed.
- RED 1: 6 behavioral failures proved review purpose validation, `/r/` URL shape,
  cross-purpose resolution, and the app client were absent.
- GREEN 1: focused suite passed 3 files, 23 tests.
- RED 2: Worker HTTP review creation succeeded but `/r/` resolution returned 404.
- GREEN 2: authenticated create/resolve and negative HTTP surface tests passed.
- RED 3: purpose/source crossing was accepted; the regression failed on its behavioral assertion.
- GREEN 3: source is now bound to purpose.
- RED 4: Cloudflare invocation logging was enabled even though invocation URLs contain opaque tokens.
- GREEN 4: `observability.logs.invocation_logs=false` is configured and contract-tested.
- RED 5: `https://www.google.com/url?review=1&q=https%3A%2F%2Fevil.test`, an encoded
  Google interstitial variant, and query-only `writereview` text were accepted.
- GREEN 5: only explicit Google `/local/writereview[/...]`, `/local/reviews[/...]`, and
  `g.page/.../review` paths pass; userinfo, non-standard ports, HTTP, deceptive hosts, and
  arbitrary Google search/interstitial routes fail.

## Automated verification

- Focused Cloudflare, app-client, config, and performance pack: 7 files, 47 tests passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with 5 pre-existing `no-explicit-any` warnings in unrelated server files;
  strict guards and all 31 Micro-Spec validations passed.
- `QA_TARGET_ENV=local QA_EXTERNAL_MUTATION_MODE=dry-run pnpm qa:background-workers`:
  19 files, 122 tests passed.
- Wrangler 4.65.0 dry deploy bundle: passed, 14.88 KiB upload / 3.91 KiB gzip, no upload performed.
- Targeted ESLint and Prettier checks passed after import/format corrections.
- The optional programming-skill audit script could not resolve its own `typescript` package from
  the plugin cache; the equivalent explicit forbidden-pattern scan found no new escape hatches.

## Manual HTTP QA

Wrangler 4.65.0 ran locally on port 8793 against an isolated persisted D1 database initialized
from `cloudflare/booking-short-links/schema.sql`. Evidence is deliberately token-redacted.

- Authorized review creation: 201.
- Repeat identical creation: 201 and the same opaque URL was reused.
- Review resolution: 302 to the expected Google `local/writereview` destination.
- Missing internal auth: 401.
- Evil host and HTTP destination: 400.
- Malformed, expired, revoked, and cross-purpose token routes: 404 without `Location`.
- Existing booking-management `/m/` route: 302 to the Nabatable origin.
- Exact Google interstitial/open-redirect adversarial cases: 400 after the fix.

No Google review was posted and no external redirect was followed.

## Runtime debugging hypotheses

1. Purpose was stored but not enforced at route resolution. Confirmed before fix by `/r/` returning
   404 because no route existed and by the core resolver accepting a booking record when asked for
   review purpose; fixed by explicit `/m/` and `/r/` purpose binding.
2. A stale or revoked KV record could bypass D1 state. Refuted by storage tests and local D1 QA:
   repository reads are D1-authoritative and revoked/expired records did not redirect.
3. Broad substring matching could turn a Google-owned interstitial into an open redirect. Confirmed
   by the failing adversarial regression; fixed by explicit host/path shapes with query strings
   excluded from purpose detection.

## Cleanup receipt

- Wrangler process stopped cleanly.
- Port 8793 has no listener.
- Isolated D1 state, response/header fixtures, and dry-build output under `/tmp/nabatable-task3-*`
  were removed.
- Empty repo-local `.wrangler` directory was removed/confirmed absent.
- No debugger statements, temporary debug logs, raw auth headers, raw opaque tokens, or review
  destinations were added to production logging.
- Generated `next-env.d.ts` build churn was restored to its baseline import via `apply_patch`.

## Residual verification truth

The first full `pnpm build` attempt correctly failed before compilation because the isolated
worktree had no required Supabase variables. A second placeholder-only build reached the Next.js
production compilation phase but did not return a conclusive completion result from the runner;
Wrangler's production-equivalent dry bundle did pass. The coordinating release worker must own the
final environment-backed Next.js build and the aggregate five-lane review before production deploy.

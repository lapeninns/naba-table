# Communications redesign and delivery reliability

Implemented locally, 27 September 2026. The supplied `nabatable-communications-prototype 2`
HTML and CSS are visual references; their fixture data and simulated actions are not production behavior.

## Acceptance criteria

- Overview, Email, Messages and Reviews share the reference navigation, typography, metric cards,
  responsive controls and accessible table regions, using the existing Radix Luma primitives.
- Restaurant and time range remain consistent across navigation. Loading, empty, unavailable,
  partial failure and stale refresh states are distinguishable.
- Restaurant changes never retain another restaurant's delivery or queue data as placeholders.
- Resend, cancel and requeue retain server authorization, CSRF, atomic claims and idempotency.
  Recovery actions refresh affected queries, including ambiguous and concurrent outcomes.
- Message reads must not silently omit the mobile ledger when it fails. Booking enrichment
  stays restaurant scoped. Existing physical-attempt deduplication and fallback lineage survive.
- Regression tests, repository verification and browser evidence cover the changed behavior.
  Live customer sends and production deployment are separate from local verification.

## Research

GitHub metadata checked 2026-09-27. Search began with notification delivery and notification
queries using `stars:>1000 archived:false`; generic notification results were not relevant enough.

- [TanStack Query](https://github.com/TanStack/query), 50,366 stars, MIT, last pushed 2026-09-27.
  Inspected README, pagination and mutation-invalidation guides, `queryObserver.ts` and its tests
  at `230cf71f88c8351e5563f2bff0867837f659f624`. Placeholder data deliberately survives changes
  to query keys; applications must constrain it at tenant boundaries. Await invalidation so
  mutations stay pending until dependent views refresh. Reuse the installed library.
- [BullMQ](https://github.com/taskforcesh/bullmq), 9,447 stars, MIT, last pushed 2026-09-27.
  Inspected README, idempotent-jobs guide, `Job.retry` and retry cases in `tests/job.test.ts` at
  `6fd5115846b0a3423fc3c44e93f6ff2dd844c908`. Retry requires an expected finished state and must
  preserve idempotence. Adapt those principles to the existing database intent queue; adding a
  Redis deployment and another queue implementation would increase operational complexity.

No external source was copied. Stars and recent pushes do not establish security. Novu was
considered but not shortlisted: GitHub reports no single identified SPDX licence and replacing
the existing providers/queue is unnecessary for this scope.

## Evidence ledger

- Reproduced both email feed and summary retaining restaurant A data after selecting restaurant B.
  Added regression tests, observed both fail, then verified all 11 tests in the two hook suites pass.
- Initial workspace already contained a communications UI redesign across 27 tracked/untracked files.
  Existing changes and generated Next.js configuration changes are preserved.
- Added failing regressions for lost-response mutation invalidation, mobile-ledger read failures,
  restaurant-scoped booking enrichment, unavailable overview metrics and stuck filtering before
  pagination. The focused run passed 17 files and 102 tests after the fixes.
- Replaced duplicate message summary reads with aggregation of the same filtered attempts used
  by the feed. Preserved physical-attempt deduplication, fallback lineage and existing database claims.
- Completed 31 local browser scenarios on the shipped communications routes using synthetic API
  fixtures: all four screens, light/dark, widths 320/390/640/768/1024/1280/1536, 200% text,
  loaded/empty/loading/error states, partial failure/recovery, navigation context and stuck filtering.
- Verified the email development harness opens its event timeline, queue and analytics and changes
  restaurants. Updated its header-link assertion for the intentional cross-channel navigation change.
- Registered the new browser spec in the nightly catalogue; its 13 contract tests pass.
- Captured the supplied HTML at 375/768/1280 in both themes and reviewed actual application
  screenshots. This adapts the references within the existing app shell and token system; the
  static prototype's sidebar and fixture values are not a replacement for the application shell/data.

## Delivery and verification boundaries

The implementation reuses TanStack Query, authenticated route handlers, existing atomic retry
claims, database intent queues, Resend and Twilio integrations. No dependencies, provider migration
or database migration were introduced. This is a redesign and reliability improvement of the live
architecture; it does not replace established delivery invariants with new client-side sending.

Message aggregation retains the existing 10,000-row read limit per ledger. A table and its summary
now share the fetched attempts, but the two ledger reads are not a transaction snapshot. The UI
reports provider observations; review observations remain venue/date-range counts, not individual
guest attribution. Delivered percentage in the cards uses all displayed attempts; the backend's
terminal-outcome delivery rate remains available separately.

Browser and route tests use fixtures/mocks. No real customer message was sent, no production
configuration was changed, and no deployment or live provider receipt was verified. Production
readiness still requires the repository's normal hosted checks and release verification.

## Final verification

- `pnpm verify`: passed in the isolated `communications-validation` checkout. Main suite: 1,479
  files, 9,511 tests passed, 5 existing skips; four Worker suites: 259 tests passed. Coverage gates,
  lint, strict types, dead-code and duplication checks passed. Lint retained seven existing warnings.
- `pnpm build`: passed using test-only environment values; source-map upload disabled. Next.js
  retains warnings about re-exported route configuration on the existing message-delivery alias.
- Browser: 31 communications layout/behavior scenarios passed, plus the email harness journey.
  Navigation and stuck-filter scenarios also passed after the final email header-link change.
- `git diff --check`: passed. Evidence logs are in `.omo/evidence/communications/` locally.

Validation used a separate checkout because another developer's server is using the original
checkout's `.next` directory. The original generated Next.js configuration was preserved. The first
root `pnpm verify` stopped at existing `tsconfig.json` formatting; only the isolated checkout's
generated configuration was formatted for its complete verification run.

## Scope verified

Four small specs are active in their numbered area folders. Each has a machine-created
`draft -> active` evidence ledger with `dirty: false`. No product or remote surface changed.

## Route/API identity rows exercised

Not applicable; governance authoring changes no runtime route.

## Commands run

- `pnpm guard:micro-specs` — baseline passed: 27 specs valid.
- `pnpm test:micro-specs` — baseline passed: 61 tests.
- Four `pnpm governance:new-spec ...` invocations — all scaffolded successfully; drafts were then
  normalized into the contract's numbered area folders before activation.
- `pnpm governance:advance <spec-id> --to active` — passed for all four specs from clean trees.
- `pnpm guard:micro-specs` — final passed: 31 specs valid.
- `pnpm test:micro-specs` — final passed: 61 tests.
- `pnpm governance:check` — final passed: 31 specs, 18 CI commands, 0 changed files.
- `node --test --test-name-pattern="Given a draft missing numbered sections When activated Then the CLI refuses" tests/micro-specs/advance-spec.test.mjs` — passed one refusal test; the malformed draft was rejected.
- `rg` status/content/ledger readback — all four specs reported `status: active`; required v1/v2,
  reminders, no-SMS, provider approval/category, and timed-smoke terms were present; all ledgers
  reported `draft -> active` and `dirty: false`.
- `git diff --name-only 36637773..HEAD` — only the allowed Micro-Specs/evidence, task folder, and
  `CONTINUITY.md` were listed.
- `git status --short` — empty before final task-record update.

## Real routes or APIs checked

None; no runtime behavior changed.

## Harness routes checked

None.

## Env safety checks

No environment or remote command was used.

## Artifacts captured

This task packet, four active specs, four machine-created transition ledgers, and scoped commits
`cbb3c1ab`, `7c0a5eb1`, `8a2d0a22`, `7c91cfa9`, `656b0270`, and `2b2f37b6`.

## Not run

Product, database, provider, deployment, and live smoke gates are implementation-phase work.
`pnpm exec prettier --check ...` was attempted but unavailable because this checkout has no
executable Prettier binary (`Command "prettier" not found`). `git diff --check` passed instead.

## Remaining caveats or blockers

No blocker for spec activation. Runtime and remote release proof intentionally remain for the
implementation program governed by these active specs.

## 2026-07-14 approved-template release continuation

### Twilio provider readback

Authenticated `ContentAndApprovals` plus per-SID `ApprovalRequests` readback returned exactly the
six final templates. No credentials or recipient data were retained.

| Template | SID | Category | Type | Status | Rejection |
| --- | --- | --- | --- | --- | --- |
| `nabatable_booking_confirmation_20260713_v2` | `HX78688ba4f6738f6fc3a8208c300ac911` | UTILITY | `twilio/call-to-action` | approved | none |
| `nabatable_booking_update_20260713_v2` | `HXa2ff8bb1dfe84884e93ed3d00b8aa1d4` | UTILITY | `twilio/call-to-action` | approved | none |
| `nabatable_booking_cancellation_20260713_v2` | `HXbc2317fae04cde871d5fb697d40cfe7f` | UTILITY | `twilio/text` | approved | none |
| `nabatable_restaurant_cancellation_20260713_v2` | `HX1502dce2894a886555e35de67412f474` | UTILITY | `twilio/text` | approved | none |
| `nabatable_manager_daily_summary_20260713_v2` | `HX6e65d006f4d22435c232bb6e734a2e3b` | UTILITY | `twilio/text` | approved | none |
| `nabatable_post_visit_review_20260713_v3` | `HXb492923d7284f0fa2409917dd7d7b9a8` | MARKETING | `twilio/call-to-action` | approved | none |

### Release-guard TDD and local gates

- RED: the release-contract test failed because code still expected deleted review `v1` and its
  `r/Review123456` sample.
- GREEN: the guard now matches `_20260713_v3` and `m/review-sample`; 11/11 focused tests passed.
- Focused release/config/env suite: 29/29 passed.
- Targeted ESLint, Prettier, TypeScript typecheck, and the TypeScript no-excuse audit passed.

### Cloudflare staging runtime

- Direct staging `/health`: 200.
- Missing authorization: 401.
- Correct authorization with malformed JSON: 400, proving the secret/header boundary.
- Valid review-link create: success with an opaque `/r/...` path.
- Real GET of the created link: 302 to the allowlisted review destination.
- Disposable staging D1 row: deleted by the smoke cleanup trap.
- Root cause of the earlier 401: the secret-change deployment had not converged at the serving edge
  before the immediate request. Polling the auth-only probe cleared it without an application edit.
- Root cause of the first 404: the QA command used HEAD against a GET-only resolver route.

### Remaining production stop gate

- Linked staging project: `ndxmivcrehsacuerwxtm`.
- Authenticated PostgREST reads against that project succeed, proving the service is healthy.
- The new `mobile_intent_status` field returns PostgreSQL `42703`, proving the review-ledger
  migration has not been applied there.
- Governed `pnpm db:status` reproduces SQLSTATE 28P01 with every stored correct-project credential.
- The stored staging database URL is malformed, and Vercel Preview currently resolves to a
  different Supabase project than the governed staging ref.
- No Vercel production Content SID, Cloudflare production manager SID, production Worker, or
  outbound recipient traffic was changed in this continuation.

### Staging credential and Preview repair

- Supabase Management API accepted the canonical staging database-password rotation with HTTP 200.
- Supabase CLI `migration list` authenticated against linked project `ndxmivcrehsacuerwxtm` after
  pooler propagation.
- Vercel exact-record updates replaced generic Preview URL, anon, and service-role values and split
  the previously shared DB URL/password record into unchanged production/development and isolated
  Preview records. A generic Preview project-ref record was added.
- Vercel pull readback matched the canonical staging URL, project ref, anon key, service-role key,
  DB URL, and rotated password. Production/development DB URL and password readbacks matched their
  pre-change values exactly.
- The one temporary Keychain copy of the rotated password was deleted after Vercel readback; no
  credential value was written to repository files or command evidence.

### Migration-order stop evidence

- Governed `pnpm db:status` now reaches staging and reports 16 local-only historical versions before
  the latest remote migration plus the pending review migration `20260712204500`.
- Governed `pnpm db:migrate` refused before writes and required Supabase `--include-all`; the safe
  runner does not expose that flag.
- A fresh linked `public` schema dump proves the gap is not metadata-only. Present examples include
  `ops_email_delivery_attempts_feed`, `update_booking_and_clear_assignments`,
  `unassign_tables_atomic`, `replace_restaurant_operating_hours`, and
  `booking_confirmation_notification_claims`. Absent examples include
  `remove_booking_table_assignments_and_reopen_if_empty`,
  `delete_restaurant_menu_section_hierarchy`, `weekly_leaderboard_reward_sends`,
  `email_unsubscribes`, `monthly_report_enabled`, and `mobile_intent_status`.
- Governed `pnpm db:check-drift` reached its shadow rebuild but failed because the remote-only
  baseline does not create `public.restaurants` before migration `20251219003000`; this command
  cannot serve as drift proof for the release.
- No migration was applied, no missing version was falsely marked applied, and production remained
  untouched.

### Governed include-all TDD and first replay

- RED: five focused contracts failed because the existing runner rejected `--include-all`, could
  not combine it with a side-effect-free dry-run, and exposed no staging/production refusal copy.
- GREEN: the runner delegates `supabase db push --include-all` only for staging `migrate`/`push`,
  refuses production even when `CONFIRM_PRODUCTION=true`, and refuses read-only workflows before
  validation. New plus existing safe-run suites pass 32/32.
- Targeted ESLint, Prettier, `pnpm typecheck`, and the TypeScript no-excuse audit passed. The runner
  is 121 pure LOC and the focused test is 80 pure LOC.
- The real dry-run rendered exactly `target=staging`, `access=migration`, validation through
  `pnpm validate:env`, and `supabase db push --include-all`, with no child execution.
- The real apply passed environment validation and listed the expected 16 backlog migrations plus
  `20260712204500_add_whatsapp_review_notification_ledger.sql`.
- Migration `20260509071600` then refused before any drop because
  `restaurant_drink_menu_modifier_options` contains 149 rows. Its transaction guard reported the
  required archive/canonical-parity precondition.
- Read-only aggregate queries found 144 legacy drink items, 64 legacy drink modifier groups, 149
  legacy drink modifier options, and zero strict canonical matches for the items, extensions, or
  options. Remote migration-history readback contains neither `20260509071600` nor
  `20260712204500`, proving the failed apply recorded neither version.
- No production configuration, production database, outbound provider traffic, or guest recipient
  was changed.

### Staging legacy preservation and successful migration replay

- RED: six preservation/safe-run contracts failed before the staging workflow and SQL existed.
  GREEN: new plus existing safe-run suites passed 38/38; the focused preservation/replay/security
  group later passed 14/14. Formatting, ESLint, typecheck, and TypeScript no-excuse checks passed.
- The staging-only dry-run rendered environment validation, the checked-in canonical hierarchy
  backfill, and the fixed archive/retirement transaction; production refusal executes no children.
- Real preparation output inserted 19 missing drink sections. Independent readback returned archive
  counts 144/64/149, all five legacy table counts zero, 144 canonical drink items, 144 extensions,
  and no archive schema/table access for `anon` or `authenticated`.
- The first resumed replay applied four versions and stopped at a historical unconditional privilege
  operation against an already retired RPC. RED/GREEN exact-signature guard coverage fixed the
  ordering defect without granting browser roles.
- The second replay applied the remaining 13 versions, including
  `20260712204500_add_whatsapp_review_notification_ledger.sql`. Governed `db:status` shows every
  local version matched remotely through that version.
- Live aggregate readback returned true for all 11 intent columns, review notification type, unique
  review index, schedule/claim/finalize RPCs, service-role schedule grant, anon denial, tenant and
  attempt triggers, and the migration-history record.
- The transactional SQL invariant proof first rolled back on a stale direct lifecycle rewrite.
  A failing-first fixture contract now requires an existing completed booking; the corrected proof
  passes against staging and ends in `ROLLBACK`.

## Task 7A staging release candidate - 2026-07-12

- Staging env validation passed and the linked project matched `ndxmivcrehsacuerwxtm`.
- The safe-run dry-run passed. Its first real read-only status command stopped on rejected database
  authentication (SQLSTATE 28P01), before any Supabase write. Migration apply/replay, transactional
  SQL, list readback, and drift therefore remain unproven.
- An isolated Cloudflare staging D1 was created in WEUR, initialized from the checked-in schema, and
  read back successfully. The existing production Worker stayed healthy and its deployed version
  remained the captured rollback baseline.
- After initial HTTP 521 failures, the final bounded retry deployed and read back the isolated
  staging Worker. Health returned 200 and missing authorization returned 401. Authenticated creation
  still returned 401 after the staging-only secret binding was set; code/tests and Wrangler readback
  agree on `INTERNAL_LINKS_TOKEN` plus the Bearer-header contract, but Cloudflare exposes no secret
  value hash for independent comparison. No production Worker was deployed.
- Focused release tests (157), security tests (227), background-worker tests (125), typecheck, lint,
  changed-file ESLint, governance, service-role guard, Luma, changed-file Prettier, and diff checks
  passed.
- Full Vitest passed 5,934 tests with one unrelated 5-second capacity stress timeout; the isolated
  13-test stress file passed with a 15-second timeout. The staging-env build compiled and typechecked,
  then failed prerendering existing dev harness routes on a React `useContext` null error.
- Exact redacted commands, resource/version readbacks, cleanup, and rollback facts are in
  `.omo/evidence/task-7a-whatsapp-review-staging.txt`.

## Adversarial radius repair

- Initial `governance:advance <spec> --to implemented --dry-run` failed for all four active specs
  because the committed task packet was outside each spec radius.
- A pre-commit repeat correctly refused a dirty tree, proving the transition cannot record stale
  metadata.
- `GOVERNANCE_CHANGED_FILES='<52 expected files>' pnpm governance:check` passed for the complete
  consent, ledger/callback, redirect Worker/client/smoke, delivery/email/env/release, and shared
  process-path set.
- Radius repair commit: `12bda84b` (`Repair WhatsApp review spec radii`).
- All four clean-tree `pnpm governance:advance <spec> --to implemented --dry-run` commands passed;
  consent, redirect, and delivery would run six fresh gates, while ledger would run seven.
- Final `pnpm guard:micro-specs` passed with 31 valid specs.
- Final `pnpm test:micro-specs` passed all 61 tests.
- Final `pnpm governance:check` passed with 31 specs, 18 CI commands, and 0 changed files.
- The 52-file synthetic governance check passed again after the radius commit.
- An implementation-surface intersection check returned no duplicate entries across the four specs.

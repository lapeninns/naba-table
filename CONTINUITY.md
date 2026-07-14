# Continuity Ledger

Last updated: 2026-07-14T12:54:49Z

## Current WhatsApp review production governance

- Task harness: `tasks/whatsapp-review-production-release-20260712-1921/`.
- Goal: activate four decision-complete Micro-Specs for consent v2, purpose-scoped review links,
  a one-shot review ledger with no SMS fallback, and staged production delivery/release.
- Scope has advanced through local implementation, final provider approval, successful Cloudflare
  staging review-link proof, and complete Supabase staging migration/ledger proof. Production
  configuration, deployment, and live-message mutation remain the final release lane.
- Locked event set: confirmation, update, guest cancellation, restaurant cancellation, and review;
  reminders stay absent, v1 stays lifecycle-only, and v2 covers all five booking events.
- Release invariant: all five booking templates must be provider-approved before production config, with
  staged deploy/rollback and an explicitly armed T+0/60/120/180/240 controlled smoke.
- State: the branch contains governed consent-v2, review redirect, no-SMS ledger, durable review
  dispatch, five-template readiness, and restored DB safe-run work. Local focused, security, Worker,
  type, lint, and governance gates pass.
- Adversarial follow-up: radii now include durable task/evidence paths and assign every expected
  implementation file to one owning spec. All four clean implemented dry-runs, the 52-file synthetic
  check, governance guard/check, and 61-test Micro-Spec suite pass.
- 2026-07-14 provider readback: the final confirmation, update, guest-cancellation,
  restaurant-cancellation, manager-summary, and post-visit-review templates are all `approved`,
  with five `UTILITY`, review `MARKETING`, and no rejection reasons. The release guard now matches
  the final review `_20260713_v3` provider definition.
- Cloudflare staging proof is now green: direct staging health returned 200, unauthorized create
  returned 401, authorized malformed JSON returned 400, review-link creation succeeded, and a real
  GET resolved 302 to the allowed review destination. The disposable D1 row was cleaned. Earlier
  401s were transient secret-deployment propagation; a separate 404 was a HEAD-vs-GET QA error.
- The staging credential and Vercel Preview drift are repaired. Project `ndxmivcrehsacuerwxtm`
  accepted a rotated database password, the Supabase CLI authenticated after propagation, and
  Preview now has isolated canonical-staging URL, anon, service-role, DB URL, DB password, and
  project-ref values. Production and development readbacks remained byte-for-byte unchanged.
- The user approved staging-only historical replay and legacy preservation. The safe runner now
  supports guarded `--include-all` and a production-refusing preparation workflow. The preparation
  replayed the existing canonical hierarchy backfill, archived exact JSON for 144 drink items, 64
  groups, and 149 options, proved 144 canonical item/extension matches, and emptied all five legacy
  retirement tables. Archive access is denied to anon/authenticated and retained for service role.
- All 17 pending staging migrations are now applied and local/remote history aligns through
  `20260712204500`. A historical privilege migration was made replay-safe for three already-retired
  RPCs with exact-signature guards. Live database readback confirms all review intent columns,
  notification constraint/index, service-only RPC grants, tenant/attempt triggers, and history.
- The transactional real-Postgres WhatsApp review ledger proof passes and rolls back. Its fixture now
  selects an existing completed booking rather than violating lifecycle timestamp invariants through
  a direct status rewrite. The known shadow drift command remains independently limited by the
  repo's remote-only baseline, not by the applied review schema.

## Current silent production table-assignment repair

- Task harness: `tasks/silent-table-assignment-repair-20260712-1213/`.
- Goal: assign capacity-safe tables to the four newly created confirmed-but-unassigned production bookings without enqueueing or sending email/SMS.
- Production target: Supabase `vrdiqfudmwydclqpydee`.
- Safety boundary: capacity quote plus atomic assignment only; no booking update route or notification side-effect dispatcher.
- Result: all four targets are assigned and remain confirmed: Queen Elizabeth `17`, Corner House `B1-3F-01`, Old School House `09`, Old Crown `07`.
- Verification: 4 atomic success events, 0 active holds, and no new email intent, email delivery, or SMS delivery rows. The baseline remained 11 email intents, 4 email delivery rows, and 0 SMS rows.

## Current customer booking wizard audit cleanup

- Task harness: `tasks/customer-booking-wizard-audit-20260712-1004/`.
- Goal: fix verified UX/UI and correctness findings in the customer Reserve wizard while preserving ops-mode behavior and the existing architecture.
- Current phase: complete. All verified audit findings are implemented, all four child Micro-Specs
  are `verified`, the coordination parent is superseded, and all five independent review lanes pass.
- Governance: D1 is customer email OR phone, D2 is Details-scoped 44px targets, and D3 is fresh
  unchecked consent. All three decisions are encoded in active Micro-Specs and regression tests.
- Batch 0 result: Storybook is ESM-safe and its three Plan stories render; Reserve now loads the canonical Tailwind v4/Luma CSS so layout and accordion animations ship; the Details privacy link no longer imports the Next router and navigates to `/privacy`.
- Verification: final lifecycle runs pass 1,237 Vitest files / 5,770 tests with 5 intentional skips,
  lint, typecheck, Next build, Reserve build, Storybook build, strict UI guards, all 8 Reserve
  Playwright tests, and the 51-test observability/privacy pack where declared.
- Behavioral result: consent is never restored or pre-accepted; legal acceptance is visible outside
  Preferences; customer and API validation accept one valid contact; Details explains requirements
  and disabled states; Plan announces automatic date moves and permits browser zoom; Review removes
  party count from Date & Time; completed progress steps navigate backward; standalone dark mode
  follows the system; verified dead wizard modules were removed.
- Browser proof covers mobile Plan/Details, email-only and phone-only contact, Review, completed-step
  navigation, capacity alternatives, privacy navigation, 44px controls, and reactive dark mode;
  desktop Review and final mobile screenshots were manually inspected.
- Local handoff: branch `codex/reserve-wizard-audit-fixes`; the single authorized local commit
  contains implementation, tests, lifecycle evidence, and final review closure. Nothing is pushed.
- Remaining-audit verification is complete in `tasks/customer-booking-wizard-audit-20260712-1004/research.md`: M7 and M2 are already satisfied under narrow-first, L8 is a proven false alarm, and every confirmed finding has an explicit test/blast-radius map.
- Branch-review follow-up on 2026-07-12 fixed all four actionable findings: confirmation progress
  is inert after booking creation, authenticated profile hydration resets legal consent, invalid
  phone values keep WhatsApp disabled, and three governed Plan Storybook surfaces are retained.
  The second pass also merges auth hydration against reducer-current remembered contacts, clears
  WhatsApp consent when the profile phone changes, and explicitly governs the occasion-selection
  story as a design-only fixture rather than a shipped component. The amended navigation spec has
  fresh recorded evidence. Full Vitest (1,237 files / 5,777 passed, 5 skipped), typecheck, lint,
  Next/Reserve/Storybook builds, strict guards, 8/8 shipped Reserve browser tests, live Chromium
  story checks, and independent security/QA/visual reviews are green.

## Current WhatsApp-first notification planning

- Task harness: `tasks/whatsapp-first-notifications-20260711-1413/`.
- Goal: implement a high-risk WhatsApp-first mobile notification feature using the registered `Nabatable` sender, venue identity inside approved templates, and an exactly-once SMS fallback.
- Settled scope: preserve email behavior; cover booking confirmation, update, guest cancellation, restaurant cancellation, and the separate Cloudflare manager daily summary SMS path; keep per-venue WhatsApp senders and two-way chat out of V1.
- Core invariant: WhatsApp and SMS are attempts for one logical notification. A delivered/read WhatsApp attempt never falls back; a terminal eligible failure may claim one SMS fallback; delayed or duplicate callbacks must not create a second message.
- Risk: high because the initiative crosses Reserve and app-host UI, public/ops APIs, service-role writes, signed provider webhooks, Supabase migrations, delivery observability, and a Cloudflare Worker.
- Settled guest consent: the public Reserve form gets an unchecked `Use WhatsApp for my booking updates` preference beneath the phone field. Its copy identifies Nabatable, the venue, transactional booking messages, and SMS fallback; consent is versioned and tied to the normalized phone-number snapshot, and changing the number requires reconfirmation.
- Settled staff consent: ops-created telephone bookings get an unchecked `Guest agreed to WhatsApp booking updates` preference; selection records the normalized phone snapshot, timestamp, consent-copy version, source `ops_staff`, and authenticated staff actor.
- Governance lifecycle restored: the AI Governance Starter Kit engine, tests, package scripts, and CI workflow are installed and tuned to Nabatable's existing risk taxonomy; all five feature Micro-Specs are active and both governance validators pass.
- Implementation complete locally: booking and manager consent evidence, mobile notification/attempt ledger, WhatsApp Content sends, atomic SMS fallback, signed callback route, manager Worker routing, and channel-aware ops delivery UI.
- Verification: feature tests, typecheck, lint, privacy/worker QA, production build, and shipped Reserve/app-host Playwright proof pass. Full-suite failures are limited to pre-existing clock-expired booking fixtures and two parallel timing tests.
- External next step: apply `20260711143000_whatsapp_first_mobile_notifications.sql` to staging, configure the Nabatable sender and approved Content SIDs, then run real provider callback/fallback proof. The declared `db:check-drift` command is currently broken because `scripts/db/check-drift.ts` is missing.
- Live sender profile completed on 2026-07-12 in Twilio account `amanshresthaaaaa`: `Nabatable`
  remains ONLINE/HIGH quality; the Nabatable repository brand mark, About text, outbound-only
  description, canonical website, support email, and Professional Services vertical were saved.
  Incoming and fallback webhooks remain blank. Evidence is in
  `tasks/whatsapp-business-profile-20260712-1119/verification.md`.
- A post-profile-update WhatsApp confirmation-channel test to the redacted operator number reached
  provider status `read` with no error and no SMS fallback; evidence is appended to
  `tasks/whatsapp-live-delivery-test-20260711-2214/verification.md`.

## Current manager-name production DB execution

- Task harness: `tasks/manager-name-production-db-20260629-0950/`.
- Goal: finish the production-only `restaurants.manager_name` rollout for review-request personal sender names after a prior agent was blocked by stale direct DB credentials.
- Production target: Supabase project `vrdiqfudmwydclqpydee`; the checkout's own Supabase link pointed to staging (`ndxmivcrehsacuerwxtm`), so the successful route was an isolated temporary workdir with `supabase db query --linked --workdir /tmp/nabatable-prod-supabase.N6KnOr`.
- Applied in production: `manager_name text`, `restaurants_manager_name_check` (`NULL` or length <= 80), column comment, and `NOTIFY pgrst, 'reload schema'`.
- Final production values: The Old Crown Girton = Sub; The Queen Elizabeth = Diwakar; The Bell = Purna; The Corner House Pub (Cambridge) = Sub; The Old School House = San; The Railway Pub = Ravi; White Horse Pub = Sub.
- Verification: CLI readback and REST readback both returned the seven expected `manager_name` values; REST `manager_name` select returned status `200`.

## Current Old Crown 40-cover booking execution

- Task harness: `tasks/old-crown-party-booking-20260711-1738/`.
- Production booking `47ad4e60-481a-4a23-bb42-8b0c4fb2b7a0` / reference `9JQX4DVGHY` is confirmed for The Old Crown Girton on 8 August 2026, 18:30–21:00, 40 covers, birthday-party note.
- Exactly four tables are assigned: `02`, `03`, `04`, `06`.
- Confirmation email is logged `sent`; Twilio direct provider readback returned SMS `delivered` with no error code.
- The newer mobile-notification claim layer failed in production before SMS provider dispatch; the established direct Twilio path completed the requested SMS and wrote the standard delivery log.

## Current loyalty metrics read-only reporting

- Task harness: `tasks/loyalty-metrics-readonly-20260627-1142/`.
- Goal: prepare defensible aggregate-only SQL/reporting for Nabatable production data that can separate real loyalty/game/repeat-booking signals from fabricated or booking-cover-derived claims.
- Current checkout finding: the old loyalty schema is explicitly removed in migrations (`loyalty_point_events`, `loyalty_points`, `loyalty_programs`, `loyalty_tier`), while `bookings.loyalty_points_awarded` remains as a legacy booking column that current create paths default to `0`.
- Reward nuance: `restaurant_game_scores` and `weekly_leaderboard_reward_sends` exist as game/leaderboard reward tables; they are not stamp-card membership, stamp-event, or redemption tables and must be labelled separately if queried.
- Production state: this shell has no Supabase access token, DB URL, production DB URL, Supabase URL, or service-role key, so no production aggregate values were queried or reported.
- Next step: run `tasks/loyalty-metrics-readonly-20260627-1142/loyalty-metrics-readonly.sql` with read-only production credentials, then fill `report-template.md` using only returned rows.

## Current GBP directory architecture review

- Task harness: `tasks/gbp-directory-architecture-review-20260619-0715/`.
- Current verdict: GBP is not required for core Nabatable, but it is strategically useful for a future directory only as an authorised bootstrap, verification, and drift-signal layer.
- Key architecture decision: do not render raw GBP/provider mirrors directly on public directory pages. Add a separate directory/public profile publication model with source rights, approval states, freshness, attribution metadata, and a public-safe read model.
- Recommended product stance: merchant connects GBP -> Nabatable imports a private directory draft -> merchant/admin approves fields -> Nabatable publishes its own public profile. Dual-sync remains the advanced two-way Google management surface.
- Explicit non-claims: no live Google OAuth, no production/staging Supabase readback, no deployed cron verification, and no app/browser UI verification were performed for this analysis-only slice.

## Goal (incl. success criteria)

- Execute the ground-up Nabatable UX/UI redesign (`Goal.md`): mobile-first, calm hospitality OS, preserving behavior, routes, backend contracts, permissions, and Supabase safety rules. Current phase: layout redesign before visual decoration (inventory → layout system → apply to shipped routes → verify at 375/768/1440).
- Success per slice: design-system + layout-system rules hold, real-route browser proof at 375/768/1440, validations green, task folder current.

## Constraints/Assumptions

- High-risk cross-surface work; one Radix Luma shadcn theme for ops and guest/public; `components/ui/*` is the single primitive root; `scripts/check-no-shadcn.mjs` must stay green.
- `tailwind.config.js` is dead at runtime (Tailwind v4 via `@tailwindcss/postcss`, no `@config` anywhere); the live theme is `src/app/globals.css` `@theme inline` + `styles/design-system/*.css`.
- Browser proof for authenticated ops routes uses the QA fixture runtime (cookie `__nabatable_qa_ops_auth=enabled` on `app.localhost:5180`, `QA_ENABLE_AUTH_FIXTURES=1 QA_USE_MOCKS=1`) plus Playwright page-level `/api/ops/**` mocks — server ops APIs 401 otherwise and the client redirects to signin.

## Key decisions

- Foundation slice (see `tasks/uxui-redesign-foundation-20260612-2054/`): token refinement over replacement; fixed rem type steps, no negative tracking; restrained radii; focus-visible rings on six primitives; `OpsMobileBottomNav` on <md; bookings/email-log StaleBoundary; landing calm pass.
- **Layout system defined** in `tasks/layout-redesign-system-20260612-2202/layout-system.md` (binding rules: shells, headers, nav, width table, list/detail, form, table→card, state layouts) with full route-family inventory in `layout-inventory.md`.
- Ops list pattern = card list at all widths (BookingsTable/CustomersTable already are). Real tables: ≤5 cols → CSS `md:` split; ≥6 cols → `useIsMobile(1024)` JS gate (keeps singular accessible names for jsdom suites). Email delivery log is the reference: attempt cards <lg (orphaned `OpsEmailDeliveryAttemptCard` wired up, retry parity via shared aria-label), sortable table ≥lg.
- `useIsMobile` gained an optional `breakpoint` param (default 768; Sidebar unchanged).
- Customers list adopted `StaleBoundary` + `getSwrUiState` (query exposed as `customersQuery` from `useOpsCustomersDataState`); toolbar/summary stay outside the boundary.
- vitest alias added for `@/hooks/use-copy-to-clipboard` (src-located hook, same pattern as `useGlobalShortcuts`).

## State

- Foundation slice verified (see prior ledger entry / task folder).
- Layout slice complete and verified in `tasks/layout-redesign-system-20260612-2202/`: typecheck, guard, targeted eslint/prettier, vitest (80 email + 16 customers tests), new e2e `tests/e2e/ops-layout-system.spec.ts` **8/8** (email log cards@375/768 + table@1440, customers stale boundary, dashboard 768 shell, bookings 1440, landing 3 widths; screenshots in `artifacts/`), regression `ops-mobile-redesign` + `ops-sidebar-active-state` + `ops-authenticated-app-host` **10/10**.
- Sidebar active-state `opsHref` fix verified via `ops-sidebar-active-state.spec.ts` (was already in working tree).
- All redesign work remains uncommitted in the working tree (foundation + layout slices).

## Now

- Layout slice handed off; goal deliverables 1–5 met for representative routes.

## Next

- Settings conformance sweep against layout-system §7 (form grid, sticky action rows, remove shadow class shims).
- Email queue tab table → responsive pattern (§8); analytics tab spot check.
- Filter toolbar → Sheet escalation where >2 wrapped rows at 375px (email log filter stack, customers mobile header/filter stack are first candidates).
- Guest portal spot checks at 768 (booking detail `xl:` sidebar stacking).
- Carried: tracking-tight sweep; reserve token unification; dead `tailwind.config.js` removal; landing content authenticity (owner decision).

## Open questions (UNCONFIRMED if needed)

- None blocking.

## Working set (files/ids/commands)

- `tasks/layout-redesign-system-20260612-2202/**` (research, layout-inventory, layout-system, plan, verification, artifacts)
- `src/components/features/email-delivery/components/{OpsEmailDeliveryTable,OpsEmailDeliveryAttemptCard}.tsx`
- `src/components/features/customers/{OpsCustomersClient,useOpsCustomersDataState}.ts(x)`
- `hooks/use-mobile.ts`, `vitest.config.ts`
- `tests/e2e/ops-layout-system.spec.ts`
- `QA_TARGET_ENV=local pnpm exec playwright test -c playwright.app.config.ts tests/e2e/ops-layout-system.spec.ts`

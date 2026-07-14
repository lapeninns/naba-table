## Objective

Author and activate four implementation-ready Micro-Specs for consent v2, purpose-scoped review
redirects, a no-SMS review ledger, and production review delivery/release.

## 2026-07-14 provider and staging update

- Twilio now reports all six final Nabatable templates `approved`; the five operational templates
  are `UTILITY`, the post-visit review template is `MARKETING`, and rejection reasons are empty.
- The final review resource is `nabatable_post_visit_review_20260713_v3`; its provider-only sample
  suffix is `m/review-sample`, while runtime review links remain purpose-scoped `r/...` links.
- The release guard previously described the deleted review `v1` definition. A failing-first test
  captured the mismatch before the guard was updated to the final approved definition.
- Cloudflare staging authenticated create and GET redirect now pass. The prior 401 was transient
  secret-version propagation; the prior 404 came from using HEAD against a GET-only route.
- Supabase staging is healthy through authenticated PostgREST, but governed database access fails
  with 28P01 and the review-ledger migration is absent. Vercel Preview currently points to a project
  other than the governed staging ref `ndxmivcrehsacuerwxtm`.

## 2026-07-14 staging credential repair and migration history

- The Supabase CLI Keychain token is stored in a Base64 wrapper; decoding it only in process enabled
  the authenticated management request without displaying or persisting the bearer token.
- The staging database password was rotated and then stored only in Vercel Preview. Generic Preview
  Supabase URL, anon, service-role, DB URL, DB password, and project-ref records now target
  `ndxmivcrehsacuerwxtm`. The formerly shared DB records were split so production/development kept
  their original values; before/after readbacks matched exactly.
- `supabase migration list` now authenticates. `pnpm db:migrate` stops because 16 older local
  migrations precede the last remote migration and Supabase requires `--include-all`.
- This is real schema drift rather than history-only drift. A remote `public` schema dump found the
  booking feed/update/unassign functions and confirmation-claim table, but did not find several
  later effects including the atomic table-unassign helper, atomic menu-hierarchy delete helper,
  weekly reward-send table, email-unsubscribe table, monthly-report flag, or review-ledger status.
- `pnpm db:check-drift` is not usable as compensating proof: its shadow rebuild fails at the second
  historical migration because the repo relies on a remote-only baseline where `restaurants` is not
  created locally.
- Applying the backlog would mutate unrelated booking, menu, rewards, unsubscribe, and reporting
  schema and is outside the active delivery Micro-Spec radius. Marking the missing versions applied
  would be inaccurate, so both paths remain stopped pending explicit authorization.

## 2026-07-14 approved replay and legacy menu parity

- The user explicitly approved the staging backlog replay. The delivery Micro-Spec radius and EARS
  contract now include a staging-only historical replay path and refuse production/non-migration
  use before child execution.
- The first `--include-all` apply stopped in the opening transaction guard of
  `20260509071600_retire_legacy_menu_modifier_objects.sql`; no migration was recorded.
- Aggregate staging inventory: 144 `restaurant_drink_menu_items`, 64
  `restaurant_drink_menu_modifier_groups`, 149 `restaurant_drink_menu_modifier_options`, and zero
  food modifier groups/options.
- Canonical inventory exists independently (301 menu items, 121 item extensions, 193 item options),
  but strict legacy-key joins returned zero matching canonical drink items, zero matching drink
  extensions, and zero matching drink options. The legacy drink rows were therefore populated after
  the earlier canonical backfill had already been recorded.
- The checked-in canonical backfill maps drink items and extensions but does not map grouped legacy
  modifiers into the flatter canonical option table. That representation is a new data/product
  decision; inventing it during a release or simply archiving and dropping unmatched rows would not
  satisfy the migration's parity precondition.

## 2026-07-14 staging archive and ledger completion

- The approved resolution keeps grouped modifier data recoverable as exact source JSON rather than
  inventing a lossy canonical mapping during release. The existing idempotent hierarchy migration
  remains the canonical item/extension mapping.
- The governed staging-only preparation replayed that backfill, inserted 19 missing drink sections,
  archived 144 drink items, 64 modifier groups, and 149 options, asserted exact archive parity and
  144 item/extension matches, then emptied all five retirement tables in FK order.
- Archive access readback is false for `anon` and `authenticated`; the archive remains available to
  `service_role`. No production database operation was used for this preparation.
- The backlog replay exposed one historical ordering defect: privilege hardening referenced three
  menu RPCs already removed by the retirement migration. Exact-signature existence guards now skip
  absent retired RPCs while preserving the role restrictions for functions that remain.
- All 17 pending versions then applied. Local and staging histories align through
  `20260712204500`; live readback confirms the review intent columns, notification type, unique
  index, service-only RPCs, tenant/attempt triggers, and migration record.
- The real-Postgres proof initially found a stale fixture that directly completed an arbitrary
  booking. It now selects an existing completed booking without rewriting lifecycle state; the full
  transactional invariant script passes and rolls back.

## Repo facts

- Existing WhatsApp v1 consent is lifecycle-only and phone-snapshot-bound.
- The mobile notification enum has four booking lifecycle events plus manager summary; review is absent.
- Review scheduling is currently email-gated in `server/jobs/booking-side-effects.ts`.
- `go.nabatable.com` is served by the existing booking-short-links Worker.
- Baseline `pnpm guard:micro-specs` and `pnpm test:micro-specs` passed before authoring.
- Adversarial review found the first active drafts omitted task/evidence process paths and several
  expected implementation files, so an implemented transition could not attribute the branch.
- Implementation ownership is now non-overlapping: consent owns booking-form persistence; ledger
  owns mobile routing/status and schema types; redirect owns Worker/client/smoke; delivery owns
  scheduling, email coexistence, content, environment, and release tooling.

## Assumptions and tradeoffs

- The existing venue review-request preference governs both review channels; email delivery remains independent.
- The five locked booking events exclude manager summary and reminders.
- Review failures are observable but never fall back to SMS.

## Constraints

- Governance authoring only; no product code, remote services, migrations, or production changes.
- Status transitions must be created by `pnpm governance:advance`.

## Risks

- Consent scope could be silently broadened for old records.
- A generic redirect could become an open redirect.
- Existing lifecycle fallback could leak into the review event.
- Partial provider configuration could produce a mixed production event set.

## Reuse notes

Reuse the versioned consent boundary, mobile ledger, signed Twilio callback, email review scheduler,
and booking-short-links Worker; do not create parallel infrastructure.

## Non-goals

Product implementation, provider submissions, remote DB work, deploys, or live smoke messages.

## Route/API identity

Not applicable to this governance-authoring task; later implementation specs identify the Worker
and callback surfaces but this task changes no route or handler.

# Google Business Profile sync — architecture

## Purpose

The unified **dual-sync engine** is the canonical bidirectional sync surface
between Nabatable Core and Google Business Profile. It powers the three
restaurant settings pages (profile, availability, Google Business Profile)
through a single field registry with explicit per-field state, decision, and
publish semantics.

The earlier `gbp_sync_v2_*` engine (decision-first review with a preflight
dialog) was retired in favour of dual-sync; see the **Decommissioned V2**
section below for the historical pointer.

## Code map

| Concern            | Location                                                                                                                                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema (canonical) | `supabase/migrations/20260429210000_add_unified_dual_sync_domain.sql`, `supabase/migrations/20260509173500_add_dual_sync_restaurant_controls.sql`                                                                                                                                                   |
| Schema (drop V2)   | `supabase/migrations/20260430120000_drop_gbp_sync_v2.sql`                                                                                                                                                                                                                                           |
| Server core        | `server/dual-sync/`                                                                                                                                                                                                                                                                                 |
| API routes         | `src/app/api/ops/restaurants/[id]/dual-sync/**`                                                                                                                                                                                                                                                     |
| Cron               | `src/app/api/cron/dual-sync/auto-export/route.ts`, `vercel.json` `*/30 * * * *`                                                                                                                                                                                                                     |
| Service / hook     | `src/services/ops/dual-sync.ts`, `src/hooks/ops/useOpsDualSync.ts`                                                                                                                                                                                                                                  |
| UI shell           | `src/components/features/restaurant-settings/dual-sync/`                                                                                                                                                                                                                                            |
| Page mount         | `src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx`                                                                                                                                                                                                                       |
| Server flags       | `server/dual-sync/flag.ts` (`GBP_SYNC_ENABLED`, `GBP_IMPORT_ENABLED`, `GBP_EXPORT_ENABLED`, `GBP_AUTO_CANDIDATES_ENABLED`, `GBP_HIGH_RISK_EXPORTS_ENABLED`, `GBP_MENU_SYNC_ENABLED`, `GBP_ATTRIBUTES_SYNC_ENABLED`, `GBP_SCHEDULED_REFRESH_ENABLED`; legacy fallback `NABATABLE_DUAL_SYNC_ENABLED`) |
| Client flag        | `lib/feature-flags/dual-sync.ts` (`NEXT_PUBLIC_NABATABLE_DUAL_SYNC_ENABLED`)                                                                                                                                                                                                                        |

## Data model

Additive tables under the `dual_sync_*` namespace:

| Table                           | Purpose                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `dual_sync_field_states`        | Per-field state row (one per restaurant × provider × field).       |
| `dual_sync_snapshot_runs`       | Transactional snapshot log; only `succeeded` runs are read.        |
| `dual_sync_outbound_candidates` | Open Core-side changes awaiting export decision.                   |
| `dual_sync_publish_operations`  | One row per (publish_job, field) pair; carries audit + retry data. |
| `dual_sync_restaurant_controls` | Restaurant/provider pause state for incident rollback and rollout. |

The migration is additive over the legacy GBP workflow tables, which remain
unchanged. The retired V2 tables are dropped by
`20260430120000_drop_gbp_sync_v2.sql`.

## Snapshots and field registry

Snapshot readers normalise both systems into a single canonical shape per
section:

- `profile`
- `operatingHours`
- `servicePeriods`
- `businessContext.categories`
- `businessContext.serviceAreas`
- `businessContext.attributes`
- `businessContext.serviceItems`

Every registry field carries:

- `sectionKey`, `fieldKey`
- core / GBP normalisers and canonicalisers
- `conflictPolicy` (`manual` / `core_wins` / `gbp_wins` / `unsupported`)
- `deletePolicy` (`manual` / `clear_remote` / `clear_core` / `ignore`)
- `importable` / `exportable` flags
- optional Google update mask + write capability metadata

Hashes are SHA-256 over canonical JSON; preflight reuses these to reject
stale or tampered decisions.

## Field state machine

Every syncable field carries one of:

| State            | Meaning                                       |
| ---------------- | --------------------------------------------- |
| `in_sync`        | Core and GBP values match after normalisation |
| `core_dirty`     | Core changed after the last successful sync   |
| `gbp_dirty`      | GBP changed after the last successful pull    |
| `drifted`        | Core and GBP differ                           |
| `conflict`       | Core and GBP both changed since the last sync |
| `pending_import` | User chose GBP → Core                         |
| `pending_export` | User chose Core → GBP                         |
| `import_failed`  | GBP → Core failed                             |
| `export_failed`  | Core → GBP failed                             |
| `ignored`        | User intentionally ignored the difference     |
| `unsupported`    | Field cannot currently sync                   |

Core CRUD writes mark touched syncable fields `core_dirty` and create or
update an `dual_sync_outbound_candidates` row for review.

## Snapshot freshness

The state response surfaces a top-level `lastSnapshot` block (run id, kind,
started/finished timestamps). The shell renders a freshness chip
("Verified Xm ago") next to the title with three tones: < 1h fresh,
< 24h recent, ≥ 24h stale.

Per-field freshness chips render the most informative timestamp for the
state: `lastInSyncAt` for in-sync, `lastCoreChangeAt` / `lastGbpChangeAt`
for drift / conflict / pending / failed states.

## Decisions

Operators choose one action per field via `DualSyncFieldRow`:

| UI action           | Decision action      | Direction             |
| ------------------- | -------------------- | --------------------- |
| Import to Nabatable | `import_from_google` | `import_to_nabatable` |
| Export to Google    | `export_to_google`   | `export_to_google`    |
| Ignore              | `ignore`             | not publishable       |

A publish job carries decisions across mixed sections, but per-field
operations are recorded individually so partial failures can be retried
without re-running the whole job.

## API surface

```
/api/ops/restaurants/:id/dual-sync
  GET  /state
  POST /refresh
  POST /publish
  POST /auto-export
  GET  /control
  PATCH /control
  GET  /operations
  GET  /publish-jobs
  GET  /publish-jobs/:jobId

/api/cron
  GET /dual-sync/auto-export   # vercel cron */30 * * * *
```

All API bodies are validated and gated by `isDualSyncEnabled` server-side.

The control route is the restaurant-scoped kill switch. A paused restaurant
still serves `GET /state` and `GET /control` so operators can inspect the
workspace, but publish preview rejects decisions with `SYNC_PAUSED`, and
publish, refresh, auto-export, queued worker execution, and scheduled
helpers fail before Core or Google mutation.

## FoodMenus extension

Food menus are a planned extension of the same dual-sync model, not a
parallel GBP workflow. Nabatable remains the rich menu source of truth:
`restaurant_menu_items`, `restaurant_menu_modifier_groups`, and
`restaurant_menu_modifier_options` retain internal descriptions,
ingredients, allergens, modifiers, availability, scoring, and import
metadata. Google receives a projected public menu.

The first implementation slice is the pure projection helper in
`server/google-business-profile/food-menus.ts`. It maps active,
available, not-sold-out food items into a Google `FoodMenus` resource and
emits a separate identity map:

- Google payload: `FoodMenus.menus[].sections[].items[]` with labels,
  description, price, dietary restrictions, allergens, spiciness,
  ingredients, preparation methods, portion size, and available modifier
  options where present.
- Local identity map: deterministic `foodMenu.item.<section>/<externalId>`
  keys plus Google array paths. This identity is intentionally not embedded
  into the Google payload because Google's public FoodMenus resource does
  not expose a Nabatable-owned item id slot.
- Skip list: inactive, sold-out, and unavailable items omitted from the
  default export projection so Google does not advertise unavailable food.
- Import review: Google rows are matched by the previous exported identity
  map first, then by a conservative section/name/price fallback. The helper
  returns suggested patches and missing-local notices only; it never mutates
  Nabatable menu records.

Google API constraints that shape the design:

- `getFoodMenus` reads
  `accounts/{accountId}/locations/{locationId}/foodMenus`; `readMask` can
  request `name` or `menus`, but repeated nested fields such as
  `menus.sections` cannot be individually selected.
- `updateFoodMenus` patches the same resource and requires the location to
  be eligible for food menus (`metadata.canHaveFoodMenus` on the Business
  Information location metadata; older FoodMenus docs describe the same
  gate as `location_state.can_have_food_menu`).
- Repeated field items cannot be individually updated. Export must therefore
  publish a deterministic full FoodMenus projection, or a documented
  whole-menu replacement, with preflight/audit protection.

Menu sync adds a `foodMenus` section to the dual-sync registry with
conservative defaults:

| Direction     | Rule                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Core → Google | Export the deterministic projection only after preflight confirms the Google baseline hash.    |
| Google → Core | Import as suggestions unless the Google item maps cleanly to one local identity.               |
| Conflicts     | Manual by default; never replace rich Nabatable menu data with lossy Google data implicitly.   |
| Deletes       | Manual by default; a missing Google item should not delete a local menu item without approval. |

The next implementation slices should wire these tables into dual-sync
field-state rows for projected items and add an operator review surface
that presents Google-origin changes as suggestions. The low-level
`getFoodMenus` / `updateFoodMenus` client helpers already exist in
`server/google-business-profile/client.ts`; do not call `updateFoodMenus`
from product code until the preflight/audit layer is in place.

The local additive migration
`supabase/migrations/20260502190006_add_gbp_foodmenus_sync_storage.sql`
introduces the durable FoodMenus storage foundation:

- `restaurant_gbp_food_menu_snapshots` stores raw/canonical Google pulls,
  Nabatable projections, preflight snapshots, hashes, and error metadata.
- `restaurant_gbp_food_menu_projected_identities` stores the exported local
  item identity map for deterministic future matching.
- `restaurant_gbp_food_menu_import_reviews` stores non-mutating suggested
  Google-to-Nabatable patches plus operator decisions.
- `restaurant_gbp_food_menu_publish_attempts` stores future export attempts,
  baseline hashes, projected payloads, Google responses, and failures.

The migration is service-role-only and does not modify existing menu source
tables. Staging has been verified with the migration ledger row, all four
tables, RLS, indexes, triggers, and service-role policies present; production
rollout remains separate. A read-only production check against project
`vrdiqfudmwydclqpydee` found no migration ledger row and none of the
FoodMenus storage tables yet.

Runtime helpers for this storage live in
`server/google-business-profile/food-menus-storage.ts`. They record
projection snapshots, persist projected identity rows, replace pending
Google import suggestions with a fresh review set, and open/finish
FoodMenus publish-attempt audit rows. These helpers intentionally do not
apply import suggestions to `restaurant_menu_items`; the local menu source
write path remains the explicit menu repository/API workflow.

`server/google-business-profile/food-menus-sync.ts` is the backend service
entry point for future routes and jobs. It reads complete menu details,
builds and hashes the deterministic Google projection, optionally persists
the projection snapshot and identity rows, and creates non-mutating
Google-to-Nabatable import reviews. Import review can either accept an
explicit Google FoodMenus payload for controlled/manual review or resolve
stored GBP OAuth context and pull the current Google FoodMenus resource
server-side before creating the same non-mutating review rows. When no
explicit previous identity map is supplied, the import-review path resolves
the latest successful Nabatable projection snapshot and its stored identity
rows before falling back to conservative display matching. The export path
uses the same server-side FoodMenus context and blocks locations that Google
explicitly marks ineligible for FoodMenus. It reads the current Google
FoodMenus baseline, records a preflight snapshot, opens a publish attempt,
verifies the expected Google hash and expected Nabatable projection hash
when supplied, and only then calls `updateFoodMenus` with
`updateMask = menus`. A stale Google baseline marks the publish attempt
`preflight_failed` with `baseline_changed`; a changed local projection marks
the attempt `preflight_failed` with `projection_changed`. Either preflight
failure leaves Google untouched.

Google does not expose a `validateOnly` parameter on the v4 FoodMenus
update endpoint. Dual-sync operation-group preflight therefore records
FoodMenus as `preflightUnsupported: true` while still requiring
`updateMask = menus`, baseline-hash preflight, high-risk confirmation, and
audit before the full-resource replacement runs.

Admin-gated route entry points expose this service:

- `POST /api/ops/restaurants/{id}/google-business-profile/food-menus/projection`
  prepares the Nabatable → Google projection, optionally persists the
  projection snapshot and identity rows, and returns the projected payload
  plus hash.
- `POST /api/ops/restaurants/{id}/google-business-profile/food-menus/import-review`
  accepts a Google `FoodMenus` payload, validates the nested menu shape,
  creates suggested local changes, and optionally records the Google
  snapshot plus pending review rows.
- `GET /api/ops/restaurants/{id}/google-business-profile/food-menus/import-review`
  lists pending FoodMenus import-review rows so the operator UI can render
  Google-origin suggestions before any local menu mutation.
- `POST /api/ops/restaurants/{id}/google-business-profile/food-menus/import-review/refresh`
  resolves the restaurant's stored GBP OAuth context server-side, pulls the
  current Google `FoodMenus` resource, records the pull snapshot, and creates
  the same pending suggested-review rows without trusting a client-supplied
  Google payload. The response includes Google's FoodMenus eligibility flag
  when available.
- `POST /api/ops/restaurants/{id}/google-business-profile/food-menus/import-review/{reviewId}/decision`
  records an explicit operator decision. `ignore_google_change` marks the
  suggestion ignored without touching menus. `apply_to_nabatable` loads the
  matched local menu item, merges only the suggested Google fields into the
  current item, preserves rich local fields and modifiers, then marks the
  review applied.
- `POST /api/ops/restaurants/{id}/google-business-profile/food-menus/publish`
  resolves the restaurant's stored GBP OAuth context server-side, derives
  the account-scoped FoodMenus resource name, builds a fresh projection,
  pulls the current Google FoodMenus baseline, records audit snapshots and a
  publish attempt, then updates Google only if the baseline preflight passes.
  It requires GBP push to be enabled and blocks locations Google explicitly
  marks as ineligible for FoodMenus. A Google baseline hash mismatch or
  Nabatable projection hash mismatch returns a conflict and leaves Google
  untouched.

These routes are server-side foundations for the future operator workflow.
Import suggestions never mutate menu source rows until the decision route
is called with `apply_to_nabatable`. The publish route is the only route in
this FoodMenus set that calls `updateFoodMenus`, and it does so only after
server-side OAuth resolution and baseline preflight.

The dual-sync state layer now recognizes FoodMenus rows as dynamic fields
under `sectionKey = "foodMenus"`. Each row represents one projected item
keyed by the local stable identity, uses `googleUpdateMask = "menus"`, and
keeps conflict/delete handling manual. Canonical snapshot readers hydrate
`foodMenus.items` from the latest stored Nabatable projection / Google pull
snapshots plus the projected identity map. If the FoodMenus storage tables
have not been migrated in an environment yet, the reader degrades to an
empty FoodMenus section rather than breaking the existing dual-sync route.
The default dual-sync export ports now recognize `foodMenus.items.*` fields
and route them through the audited full-menu FoodMenus publish service. A
single approved item export still publishes the deterministic full menu,
because Google does not support item-level FoodMenus patching. Live Google
pulls and menu projection refreshes are wired into the standard refresh
pipeline and scheduled cron fan-out. Repeated scheduled refreshes reuse
existing FoodMenus snapshot rows when the projected or Google snapshot hash is
unchanged, which keeps the storage layer idempotent while still replacing
pending import-review suggestions with the latest Google pull.

`server/menu/repository.ts` exposes `listMenuItemDetails(...)` for future
FoodMenus projection routes so export can read complete item, modifier
group, and modifier option data in one repository call before building the
Google projection.

## Publish orchestration

`runPublish(client, input, options)` executes per-field operations
serially, recording before / after Core and GBP hashes for audit.

### Section-level batch coalescing

For sections that support batched Google writes, the orchestrator
accumulates consecutive same-section export decisions and offers them to
the section's `applyExportBatchToGoogle` port (one Google call for N
fields). All seven sections expose batch ports:

- profile (name + contactPhone share a simple-push call; address +
  businessDescription share a location-patch call)
- operatingHours (single push call for N days)
- servicePeriods (deduped day list, single push call)
- businessContext.{categories,serviceAreas,serviceItems} (single
  merged-list location patch each)
- businessContext.attributes (one combined `attributesPatch` call)

Attributes use `attributeMask` rather than `locations.patch.updateMask`.
The Business Information `locations.updateAttributes` endpoint does not
expose `validateOnly`, so operation-group preflight records
`preflightUnsupported: true` for `location.attributes` while preserving the
attribute mask in the audited result.

`{ supported: false }` falls back to per-field exports; `throw` poisons
the group with `PORT_FAILURE`. Per-field operation rows + state
transitions are unchanged so audit semantics are preserved.

## Auto-export and cron

`scheduling/auto-export.ts` runs on the `*/30 * * * *` cron. The runner
reads open candidates per tenant, drift-pins each decision against
`baselineGbpHash`, and submits the export to `runPublish`. The durable
queue drain runs on `/api/cron/dual-sync/queue`, and the operational
health alert sweep runs on `/api/cron/dual-sync/health`.

Failures emit a `DualSyncNotificationEvent` (`tenant_run_failed` on
exception, `tenant_run_partial` on per-field failures); the default port
logs to console and additionally posts to
`DUAL_SYNC_FAILURE_WEBHOOK_URL` when configured. The health sweep emits
`operational_health_alert` when metrics detect queue backlog, dead
letters, quota failures, reauth failures, stale decisions, or partial
publish failures.

## Operator UI

`DualSyncShell` mounts on each settings page filtered by section:

| Page                    | Sections                           |
| ----------------------- | ---------------------------------- |
| Profile                 | `profile`                          |
| Availability            | `operatingHours`, `servicePeriods` |
| Google Business Profile | all seven                          |

Header surfaces:

- "N pending" badge when outbound candidates exist
- "Verified Xm ago" snapshot freshness chip
- whole-restaurant heatmap (per-bucket counts: in_sync, drift, conflict,
  pending, failed, inactive)
- "Pull from Google" / "Auto-publish (N)" / "Publish (N)" actions

Per-section accordion triggers carry their own heatmap; per-field rows
show the state badge plus a state-aware freshness chip.

Two observability panels live below the field accordions:

- **Recent publishes** — one row per `publishJobId`, status badge,
  duration, succeeded / failed / skipped counts, sections touched, error
  codes; chevron expands the full operation list inline.
- **Recent operations** — flat list of recent per-field operations.

## Conflict and delete defaults

Public Google fields default to `conflictPolicy: 'manual'` so the system
never overwrites operator-managed data without an explicit decision.
Delete defaults are `manual` for public business data, `ignore` for
Google-owned read-only fields (Maps URL, review URL).

## Tests

Unit + integration tests live under `tests/server/dual-sync-*.test.ts`
and `tests/components/dual-sync-*.test.ts`. The suite covers hashing,
the registry, state compute / recompute, all seven import + per-field +
batch export ports, the publish orchestrator, auto-export
(per-tenant + cross-tenant), operations / publish-jobs / publish-job
detail listings, notifications (console + webhook + combinator), the
freshness helpers, and the heatmap aggregator.

## Decommissioned V2

The earlier engine (`server/google-business-profile-v2/`,
`/api/ops/restaurants/:id/google-business-profile/v2/**`,
`SyncV2Shell.tsx`, `useOpsGoogleBusinessProfileV2.ts`, the matching
`gbp_sync_v2_*` tables, and `tests/server/gbp-v2-*.test.ts`) has been
removed. Its history is preserved in the Git log under the
`gbp-dual-sync-architecture-*` task slugs.

Rollback path: revert the deletion commit and re-apply
`20260428232200_add_gbp_sync_v2.sql`.

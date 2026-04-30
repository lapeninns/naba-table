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

| Concern            | Location                                                                        |
| ------------------ | ------------------------------------------------------------------------------- |
| Schema (canonical) | `supabase/migrations/20260429210000_add_unified_dual_sync_domain.sql`           |
| Schema (drop V2)   | `supabase/migrations/20260430120000_drop_gbp_sync_v2.sql`                       |
| Server core        | `server/dual-sync/`                                                             |
| API routes         | `src/app/api/ops/restaurants/[id]/dual-sync/**`                                 |
| Cron               | `src/app/api/cron/dual-sync/auto-export/route.ts`, `vercel.json` `*/30 * * * *` |
| Service / hook     | `src/services/ops/dual-sync.ts`, `src/hooks/ops/useOpsDualSync.ts`              |
| UI shell           | `src/components/features/restaurant-settings/dual-sync/`                        |
| Page mount         | `src/components/features/restaurant-settings/OpsRestaurantSettingsClient.tsx`   |
| Server flag        | `server/dual-sync/flag.ts` (`NABATABLE_DUAL_SYNC_ENABLED`)                      |
| Client flag        | `lib/feature-flags/dual-sync.ts` (`NEXT_PUBLIC_NABATABLE_DUAL_SYNC_ENABLED`)    |

## Data model

Four additive tables under the `dual_sync_*` namespace:

| Table                           | Purpose                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `dual_sync_field_states`        | Per-field state row (one per restaurant × provider × field).       |
| `dual_sync_snapshot_runs`       | Transactional snapshot log; only `succeeded` runs are read.        |
| `dual_sync_outbound_candidates` | Open Core-side changes awaiting export decision.                   |
| `dual_sync_publish_operations`  | One row per (publish_job, field) pair; carries audit + retry data. |

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
  GET  /operations
  GET  /publish-jobs
  GET  /publish-jobs/:jobId

/api/cron
  GET /dual-sync/auto-export   # vercel cron */30 * * * *
```

All API bodies are validated and gated by `isDualSyncEnabled` server-side.

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

`{ supported: false }` falls back to per-field exports; `throw` poisons
the group with `PORT_FAILURE`. Per-field operation rows + state
transitions are unchanged so audit semantics are preserved.

## Auto-export and cron

`scheduling/auto-export.ts` runs on the `*/30 * * * *` cron. The runner
reads open candidates per tenant, drift-pins each decision against
`baselineGbpHash`, and submits the export to `runPublish`.

Failures emit a `DualSyncNotificationEvent` (`tenant_run_failed` on
exception, `tenant_run_partial` on per-field failures); the default port
logs to console and additionally posts to
`DUAL_SYNC_FAILURE_WEBHOOK_URL` when configured.

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

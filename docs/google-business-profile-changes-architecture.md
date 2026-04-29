# Google Business Profile Sync V2 Architecture

## Purpose

Google Business Profile Sync V2 is the replacement architecture for GBP review and publish workflows. It introduces a versioned, decision-first engine for both supported directions:

- `import_to_nabatable`: Google is the winner; apply reviewed Google values to Nabatable.
- `export_to_google`: Nabatable is the winner; patch reviewed Nabatable values to Google.

Legacy workflow routes stay alive during rollout, but V2 has isolated schema, API routes, service contracts, hooks, UI state, preflight locks, publish jobs, and audit events.

## Data Model

V2 uses additive tables with the `gbp_sync_v2_*` namespace:

| Table                        | Purpose                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `gbp_sync_v2_workflows`      | One workflow root per restaurant/provider.                                                               |
| `gbp_sync_v2_drafts`         | Canonical Nabatable and Google snapshots plus deterministic diff items.                                  |
| `gbp_sync_v2_decisions`      | Field-level operator decisions; this is the only selection source of truth.                              |
| `gbp_sync_v2_publish_jobs`   | Frozen preflight contract with idempotency key, direction intent, snapshot hashes, and frozen decisions. |
| `gbp_sync_v2_publish_events` | Immutable audit trail for Nabatable apply, Google patch, and rollback legs.                              |

The migration is additive and does not mutate legacy GBP workflow tables.

## Snapshot And Diff Contract

Snapshot readers normalize both systems into the same section shapes before diffing:

- `profile`
- `operatingHours`
- `servicePeriods`
- `businessContext.categories`
- `businessContext.serviceAreas`
- `businessContext.attributes`
- `businessContext.serviceItems`

Every diff item carries:

- `sectionKey`
- `fieldKey`
- `normalizedNabatableValue`
- `normalizedGoogleValue`
- `nabatableValueHash`
- `googleValueHash`
- capability flags: `canImport`, `canExport`, `canIgnore`, optional `googleUpdateMask`

Hashes are SHA-256 over canonical JSON. Preflight and publish use those hashes to reject stale or tampered decisions.

## Decision Semantics

Operators choose one action per field:

| UI action           | Decision action      | Publish direction     |
| ------------------- | -------------------- | --------------------- |
| Import to Nabatable | `import_from_google` | `import_to_nabatable` |
| Export to Google    | `export_to_google`   | `export_to_google`    |
| Ignore              | `ignore`             | Not publishable       |

V2 does not publish mixed directions in one job. A publish job is either an import job or an export job.

## API Surface

V2 API routes live under:

```txt
/api/ops/restaurants/:id/google-business-profile/v2
```

Routes:

| Route                        | Method  | Contract                                                  |
| ---------------------------- | ------- | --------------------------------------------------------- |
| `/drafts`                    | `POST`  | Compose a fresh V2 draft from live snapshots.             |
| `/drafts/:draftId`           | `GET`   | Read draft and current decisions.                         |
| `/drafts/:draftId`           | `PATCH` | Upsert decisions after zod validation.                    |
| `/drafts/:draftId/preflight` | `POST`  | Validate decisions and persist a frozen publish job.      |
| `/drafts/:draftId/publish`   | `POST`  | Verify password, re-check contract lock, execute publish. |

All route bodies are validated with zod in `_v2-schemas.ts`. Legacy route contracts are not mixed into V2 responses.

## Preflight Contract

Preflight verifies:

- Draft exists and belongs to the restaurant.
- At least one selected item is publishable.
- Every selected action matches the requested direction.
- Selected decision hashes still match the draft diff item hashes.
- Selected field capabilities allow the requested action.
- Export jobs require Google write eligibility.

Successful preflight persists:

- `publishPlanId`
- `idempotencyKey`
- `directionIntent`
- `frozenDecisions`
- `frozenDecisionsHash`
- `frozenNabatableSnapshotHash`
- `frozenGoogleSnapshotHash`
- `googleUpdateMasks`
- full `preflightResult`

Publish must use the frozen job and cannot proceed if live snapshots or field hashes drift.

## Publish Orchestration

`PublishOrchestratorV2` has two pipelines.

### Import To Nabatable

The import pipeline applies reviewed Google winners through existing core writers:

- profile fields through `updateRestaurantDetails`
- weekly operating hours through `updateOperatingHours`
- service periods through `updateServicePeriods`
- business-context rows through `updateRestaurantBusinessContext`

The pipeline records a `nabatable_apply` audit event with old and new selected values.

### Export To Google

The export pipeline uses existing verified Google write paths:

- profile title/phone through `syncRestaurantProfileWithGoogleBusinessProfile`
- profile storefront address through a V2 `storefrontAddress` patch when Google already has structured address metadata to preserve
- regular hours through `syncRestaurantOperatingHoursWithGoogleBusinessProfile`
- service periods/more hours through `syncRestaurantServicePeriodsWithGoogleBusinessProfile`
- categories, service areas, and service items through V2 `locations.patch` payload builders
- attributes through V2 `locations.updateAttributes`

Business-context export is capability-gated per row. V2 only offers Export to Google when the canonical Nabatable value contains the API-shaped data required for the Google request, such as category codes, service-area region/place payloads, attribute resource names and values, or service-item payloads.

The pipeline records a `google_patch` audit event with update masks and selected old/new values.

## Sync Capability Matrix

| Section/field             | Import Google to Nabatable | Export Nabatable to Google                                  | Current blocker when not both-direction                                                                                                                          |
| ------------------------- | -------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile name              | Yes                        | Yes                                                         | None. Uses Google `title`.                                                                                                                                       |
| Profile phone             | Yes                        | Yes                                                         | None. Uses Google `phoneNumbers`.                                                                                                                                |
| Profile address           | Yes                        | Yes, when Google has structured address metadata            | Uses the reviewed Nabatable address as Google `addressLines` while preserving Google's existing region/locality fields.                                          |
| Profile Google Maps URL   | Yes                        | No                                                          | Google returns this as output-only metadata; it is not directly writable.                                                                                        |
| Profile Google review URL | Yes                        | No                                                          | Google returns this as generated link metadata; it is not directly writable.                                                                                     |
| Operating hours           | Yes                        | Yes                                                         | None for regular weekly hours.                                                                                                                                   |
| Service periods           | Yes                        | Yes, when Google exposes a writable kitchen more-hours type | Google write availability depends on the location's `moreHoursTypes`.                                                                                            |
| Categories                | Yes                        | Yes, when category codes exist                              | Google requires category resource names/codes and a valid primary category.                                                                                      |
| Service areas             | Yes                        | Yes, when region or place payload exists                    | Google requires a valid `serviceArea` payload.                                                                                                                   |
| Attributes                | Yes                        | Yes, when a writable value exists                           | Google attributes use `locations.updateAttributes`; repeated-enum exports require raw Google enum IDs. Deletes use `attributeMask` without a matching body item. |
| Service items             | Yes                        | Yes, when canonical service-item payload exists             | Free-text display rows without the original Google service-item payload remain import-only.                                                                      |

## Idempotency And Conflict Safety

Idempotency is enforced by `gbp_sync_v2_publish_jobs.idempotency_key` and the orchestrator status guard. A job that is no longer `preflight_locked` is not re-run.

Publish re-checks:

- frozen decision hash equals the persisted frozen decision set
- live Nabatable snapshot hash equals the preflight hash
- live Google snapshot hash equals the preflight hash
- every frozen decision still exists in the live diff
- every frozen decision still has matching Nabatable and Google value hashes

Any mismatch fails the job with contract-lock errors before writers run.

## UI Contract

The ops UI renders `SyncV2Shell` directly for linked Google Business Profile locations.

State model:

- persisted decisions from the API
- pending local decision edits
- derived progress and publish enablement

The UI does not keep an independent selected state. It sends decision rows with reviewed value hashes, then preflight/publish operate on persisted decisions.

## Rollout

Rollout sequence:

1. Validate import and export jobs on staging before production.
2. Keep legacy route modules available only for rollback during the stable window.
3. Remove legacy routes, UI components, and tables after the stable window.

## Current Boundaries

- V2 schema is additive and must be applied to staging before production.
- Business-context import and export are supported where the row has enough API-shaped data for Google.
- Google-owned profile links such as Maps URL and review URL are import-only.
- No publish is allowed without a successful preflight job and password confirmation.
- Browser verification on the real ops route is required before claiming UI completion.

# Google Business Profile Settings Page - Dual-Sync Architecture

Source: https://windsurf.com/codemaps/1ebf1db3-4951-4291-92b1-7f03b07d0aef-d2cf16b49120301c

Captured: 09/05/2026, 13:22:53 Europe/London

Rendered URL: https://windsurf.com/codemaps/1ebf1db3-4951-4291-92b1-7f03b07d0aef-d2cf16b49120301c

This is a local Markdown capture of the rendered Windsurf codemap. It preserves the codemap text, section summaries, node labels, referenced local files, and visible code snippets after expanding all sections.

## Rendered Codemap Capture

End-to-end architecture for the Google Business Profile settings page at /settings/restaurant/google-business-profile, covering Next.js page rendering, OAuth connection flow, dual-sync engine for bidirectional synchronization, field registry with state computation, and publish orchestration. Key entry points: page render [1a], OAuth connect [2b], refresh from Google [3b], state computation [4d], and publish execution [5c].

## 1. Page Load & Component Rendering

Next.js App Router page rendering flow from route definition through layout authentication to client component hydration with Google Business Profile connection state.

### Motivation

The Google Business Profile settings page exists to solve a critical integration problem: restaurant operators need to synchronize their business data between Nabatable's reservation system and Google Business Profile without manually maintaining two separate systems. This page provides a unified interface where operators can connect their Google account, select which Google location maps to their restaurant, and review/approve bidirectional sync changes before they propagate to either system [1a].

The architecture must handle OAuth authentication, maintain encrypted credentials, track per-field sync states across 8 different data sections (profile, hours, service periods, categories, service areas, attributes, service items, and food menus), and provide operators with granular control over what syncs and when.

### Details

#### Page Rendering Architecture

The page follows Next.js 14 App Router conventions with a nested layout structure. The route definition at /settings/restaurant/google-business-profile/page.tsx renders OpsRestaurantSettingsClient with a view prop [1a]. This client component is wrapped by RestaurantSettingsPageShell in the layout [1b], which provides authentication checks, navigation, and restaurant context.

The layout hierarchy flows: root app layout → restaurant settings layout → page component → client components [1b]. The root layout at /app/(app)/layout.tsx establishes the OpsShell with sidebar navigation and wraps everything in session providers that manage user authentication and active restaurant selection.

#### Component Composition

OpsRestaurantSettingsClient acts as a view router that conditionally renders different settings sections based on the view prop [1c]. For the google-business-profile view, it renders two main components:

GoogleBusinessProfileSection - Handles OAuth connection status, location selection, and connection management [1c]
DualSyncShell - Renders the field-by-field sync workspace with all 8 GBP sections [1d]

The sections are configured via DUAL_SYNC_SECTIONS_BY_VIEW which maps the google-business-profile view to all available sync sections including profile, operatingHours, servicePeriods, and the four businessContext subsections [1d].

#### Data Fetching Pattern

The page uses React Query for server state management. When GoogleBusinessProfileSection mounts, it immediately invokes useOpsGoogleBusinessProfileConnection [1e], which calls the restaurant service layer [1f]. This service makes a GET request to /api/ops/restaurants/[id]/google-business-profile [1g], which in turn calls getGoogleBusinessProfileConnectionState to retrieve the current OAuth connection status, linked location metadata, and available locations from the database [1g].

The connection state determines which UI the user sees: a connect button if unlinked, a location picker if authorized but not linked, or the full sync workspace if linked. This state-driven rendering ensures operators always see the appropriate next step in the setup workflow.

#### Authentication & Authorization

Every route in this flow requires authentication. The restaurant settings layout checks for a valid user session and redirects to /app/auth/signin if not authenticated [1b]. The API routes enforce admin-level access using ensureRestaurantAdminAccess, ensuring only restaurant owners and admins can modify Google Business Profile connections.

#### Next.js App Router - Page Rendering Flow

Route Definition
1a
Page Component Export
page.tsx
14
return &lt;OpsRestaurantSettingsClient view="google-business-profile" /&gt;;
renders OpsRestaurantSettingsClient
Layout Hierarchy
/app/(app)/layout.tsx
OpsShell + Auth Providers
1b
Layout Shell Wrapper
layout.tsx
24
return &lt;RestaurantSettingsPageShell&gt;{children}&lt;/RestaurantSettingsPageShell&gt;;
RestaurantSettingsPageShell wrapper
Client Component Hydration
1c
GBP Section Render
OpsRestaurantSettingsClient.tsx
197
&lt;GoogleBusinessProfileSection restaurantId={restaurantId} hasSyncWorkspace={hasSyncWorkspace} /&gt;
GoogleBusinessProfileSection mount
1e
Connection State Query
GoogleBusinessProfileSection.tsx
298
const connectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
1f
Service Layer Fetch
useOpsGoogleBusinessProfile.ts
36
return restaurantService.getGoogleBusinessProfileConnection(restaurantId);
1g
Connection State Retrieval
route.ts
52
const state = await getGoogleBusinessProfileConnectionState(restaurantId);
getConnectionState()
1d
Dual-Sync Shell Mount
OpsRestaurantSettingsClient.tsx
216
&lt;DualSyncShell restaurantId={selectedRestaurantId} sections={dualSyncSections} singleOpenSections={view === 'google-business-profile'} /&gt;
sections={all 8 GBP sections}
Data Fetching
React Query hydrates connection state

## 2. OAuth Connection & Location Linking Flow

Google OAuth authorization flow from initial connect button through callback handling to location selection and credential storage in restaurant_external_profiles table.

### Motivation

Restaurants need to connect their Nabatable account to their Google Business Profile to enable bidirectional synchronization of business information (name, address, hours, menu). The OAuth connection flow solves the problem of securely authenticating with Google's API and selecting which specific Google location to sync with, since a restaurant may have multiple locations in their Google account.

The flow must handle three critical challenges:

Secure OAuth 2.0 authorization with Google to obtain API access tokens
Location disambiguation - letting operators choose which Google location maps to this Nabatable restaurant
Persistent credential storage with encryption for ongoing API access

### Details

#### OAuth Authorization Flow

The connection begins when a user clicks the "Connect Google" button [2a], which navigates to /google-business-profile/connect [2b]. This route generates a random state token for CSRF protection and builds a Google OAuth consent URL with the required scopes (business.manage). The user is redirected to Google's authorization page.

After the user grants permission, Google redirects back to the callback route [2c] with an authorization code. The callback handler validates the state token, then calls exchangeGoogleBusinessProfileCode() to trade the authorization code for access and refresh tokens. These tokens are encrypted using AES-256 via encryptGoogleBusinessProfileSecret() before being stored in the restaurant_external_profile_credentials table.

#### Location Selection & Linking

Once authorized, the connection status becomes authorized and the UI fetches available Google locations by calling the Google My Business API. The operator sees a dropdown of their Google locations and selects the one that matches this Nabatable restaurant.

When they click "Link", a mutation [2d] calls linkGoogleBusinessProfileLocation() [2g], which updates the restaurant_external_profiles table with the selected external_location_id and external_account_id. The status transitions to linked.

The service then triggers an initial sync by calling syncGoogleBusinessProfileBusinessInformation(), which pulls the location's profile data, operating hours, and business context from Google into mirror tables (gbp\_\* schema) that feed the dual-sync engine.

#### Credential Management

The encrypted OAuth tokens are stored separately from the profile metadata. The restaurant_external_profile_credentials table tracks token expiry, and the system automatically refreshes access tokens using the refresh token when they expire. If refresh fails (e.g., user revoked access), the connection status becomes reauth_required, prompting the operator to reconnect.

OAuth Connection & Location Linking Flow
User clicks "Connect Google" button
2a
Connect Button Href
GoogleBusinessProfileSection.tsx
462
connectHref={connectHref}
2b
Connect Route Handler
route.ts
1
// OAuth connect route handler
Generate OAuth state token
Build Google consent URL
Redirect to Google
User authorizes on Google
Google redirects to callback
2c
OAuth Callback Handler
route.ts
1
// OAuth callback route
Validate state token
Exchange code for tokens
Encrypt & store credentials
Redirect to settings page
User selects location & clicks "Link"
2d
Location Link Mutation
GoogleBusinessProfileSection.tsx
431
linkMutation.mutate({ accountName: selectedLocation.accountName, accountId: selectedLocation.accountId, locationName: selectedLocation.locationName, locationId: selectedLocation.locationId }
2e
Link Service Call
useOpsGoogleBusinessProfile.ts
83
return restaurantService.linkGoogleBusinessProfileLocation(restaurantId, payload);
2f
Link Location Service
route.ts
87
const state = await linkGoogleBusinessProfileLocation(restaurantId, payload);
2g
Credential & Profile Update
service.ts
1
// linkGoogleBusinessProfileLocation implementation
Update external_profiles table
Store location metadata
Trigger initial sync

## 3. Dual-Sync Refresh - Pull from Google

Manual refresh flow that pulls latest Google Business Profile data, creates snapshot run, normalizes to canonical format, and recomputes all field states in dual_sync_field_states table.

### Motivation

The dual-sync refresh flow solves a critical synchronization problem: keeping Nabatable's restaurant data in sync with Google Business Profile without losing changes made on either side. When a restaurant updates their hours in Google or their menu in Nabatable, the system needs to detect these changes, compute the current state of every syncable field, and present operators with accurate import/export decisions.

The "Pull from Google" button [3a] triggers this refresh flow, which fetches the latest data from Google's API, normalizes both systems into a canonical format, and recomputes sync states for all fields to answer: "Is this field in sync? Has Core changed? Has Google changed? Are they in conflict?"

### Details

#### User-Triggered Refresh

When an operator clicks "Pull from Google" in the DualSyncShell component [3a], the system invokes a React Query mutation [3b] that calls POST /api/ops/restaurants/{id}/dual-sync/refresh [3c]. This API route is rate-limited to prevent abuse of Google's API quota.

#### Snapshot Run Creation

The refresh service [3d] begins by creating a pending snapshot run in the dual_sync_snapshot_runs table. This run acts as a transactional log entry with a unique ID, timestamp, and run kind (manual/scheduled/core_write). The run tracks whether the refresh succeeded or failed.

#### Google API Pull

The service calls syncGoogleBusinessProfileBusinessInformation() [3e], which uses stored OAuth credentials to fetch the restaurant's current location profile, operating hours, service periods, categories, and attributes from Google Business Profile API. This data is written to mirror tables (restaurant*gbp*\*) for durability.

#### Canonical Snapshot Normalization

The system reads data from both sides in parallel [3f, 3g]:

Google snapshot [3f]: Reads from the gbp\_\* mirror tables and normalizes Google's API format into a canonical shape
Nabatable snapshot [3g]: Reads from restaurants, restaurant_operating_hours, restaurant_service_periods, and business context tables

Both snapshots are normalized to the same canonical format with sections for profile, operatingHours, servicePeriods, businessContext (categories, serviceAreas, attributes, serviceItems), and foodMenus. This normalization allows the registry to compare fields using a unified structure.

#### State Recomputation

The final step [3h] iterates through every field in the registry, computes SHA-256 hashes of the canonical values, and compares them to determine the sync state:

in_sync: Core and Google hashes match
core_dirty: Core changed since last sync
gbp_dirty: Google changed since last sync
conflict: Both changed since last sync

The system upserts rows in dual_sync_field_states with the new state, current hashes, and a reference to the snapshot run ID. This state machine drives the UI's display of which fields need operator decisions.

#### Transactional Guarantee

The snapshot run is committed with the canonical Google snapshot stored as JSONB. This creates an audit trail showing exactly what Google returned at a specific timestamp, enabling drift detection and preflight validation during publish operations.

Dual-Sync Refresh Flow (Pull from Google)
UI Layer
DualSyncShell component
onClickRefresh handler
3a
Refresh Button Click
DualSyncShell.tsx
255
await refreshMutation.mutateAsync();
React Query Hook Layer
useOpsDualSync hook
refreshMutation.mutateFn
3b
Refresh Service Call
useOpsDualSync.ts
107
return refreshDualSync(restaurantId);
API Route Layer
3c
Refresh Route Handler
route.ts
52
const result = await refreshFromGoogle({ client: getServiceSupabaseClient(), restaurantId, runKind: 'manual' });
refreshFromGoogle() service call
Dual-Sync Service Layer
3d

#### Snapshot Run Creation

service.ts
1
// refreshFromGoogle implementation
openSnapshotRun() - create pending run
3e

#### Google API Pull

service.ts
1
// syncGoogleBusinessProfileBusinessInformation
Google API calls (location, hours)
Parallel snapshot reads
3f
Google Snapshot Read
google.ts
40
const [info, foodMenus] = await Promise.all([readGoogleBusinessProfileBusinessInfo(restaurantId, client), readStoredGoogleFoodMenusSection({ client, restaurantId })]);
readGBPBusinessInfo from gbp\_\*
3g
Core Snapshot Read
nabatable.ts
41
const [details, hours, periods, context, foodMenus] = await Promise.all([getRestaurantDetails(restaurantId, client), getOperatingHours(restaurantId, client), getServicePeriods(restaurantId, client), getRestaurantBusinessContext(restaurantId, client), readStoredNabatableFoodMenusSection({ client, restaurantId })]);
getRestaurantDetails/Hours/etc
commitSnapshotRun() - save canonical
3h

#### State Recomputation

recompute.ts
1
// recomputeAllStates implementation
upsert dual_sync_field_states
Database Layer
dual_sync_snapshot_runs (insert)
dual_sync_field_states (upsert)

## 4. Field Registry & State Computation Engine

Core dual-sync logic that builds dynamic field registry from snapshots, resolves per-field capabilities, computes sync states by comparing canonical hashes, and determines import/export eligibility.

### Motivation

The dual-sync engine solves the problem of keeping restaurant data synchronized between two systems: Nabatable's internal database (Core) and Google Business Profile. Without this system, operators would need to manually maintain identical information in both places—updating hours, contact details, service areas, and menus twice whenever anything changes.

The core challenge is detecting what changed and in which direction. If a restaurant updates their phone number in Nabatable, should it overwrite Google's version? What if Google's version was updated more recently? What if both changed since the last sync? The field registry and state computation engine [4a-4h] answers these questions automatically for every syncable field.

### Details

#### Canonical Snapshots

The system starts by reading two complete snapshots of restaurant data [4a]: one from Nabatable's restaurants table and related tables [4g], and one from Google's cached data in gbp\_\* mirror tables. Both snapshots are normalized into an identical canonical format with sections for profile, operating hours, service periods, business context, and food menus.

#### Dynamic Field Registry

The registry [4b, 4c] is not a static list—it's built dynamically for each restaurant. Static fields like profile.name and operatingHours.weekly are combined with per-restaurant dynamic fields like individual service periods (lunch, dinner) and business context attributes (outdoor seating, wheelchair accessible). This produces a complete list of every syncable field for that specific restaurant.

#### Capability Resolution

For each field, the system determines what actions are possible [4d, 4e]. A field can only be imported if Google has a non-null value [4e]. A field can only be exported if Core has a value to send. These capability flags (canImport, canExport) prevent operators from attempting impossible sync operations.

#### Hash-Based State Detection

The system computes SHA-256 hashes of the canonical values [4f] and compares them to last_in_sync_hash stored in the dual_sync_field_states table. If both current hashes match the last-in-sync hash, the field is in_sync. If only Core's hash changed, it's core_dirty. If only Google's changed, it's gbp_dirty. If both changed, it's a conflict requiring manual resolution.

#### State Summary Response

The API returns [4h] a complete field summary to the UI: current values from both sides, canonical hashes, computed state, sync capabilities, and any open export candidates queued from previous Core writes. This single response gives operators everything needed to make informed sync decisions without additional round trips.

#### Why This Matters

This architecture means operators see exactly what differs between Nabatable and Google, field by field, with clear guidance on what can be imported, exported, or needs manual attention. The hash-based drift detection ensures decisions are made against fresh data, preventing accidental overwrites of recent changes.

GET /dual-sync/state API Route
4a
Dual Snapshot Read
route.ts
58
const [coreSnapshot, gbpSnapshot] = await Promise.all([readNabatableSnapshot({ client, restaurantId }), readGoogleSnapshot({ client, restaurantId })]);
readNabatableSnapshot()
4g
State Machine Logic
recompute.ts
1
// computeFieldState logic
readGoogleSnapshot()
Fetch from gbp\_\* mirror tables
4b
Registry Build
route.ts
63
const registry = buildRegistry({ coreSnapshot, gbpSnapshot, includeCoreOnly: true });
4c
Registry Composition
index.ts
106
return [...PROFILE_FIELDS, ...OPERATING_HOURS_FIELDS, ...dynamicServicePeriods, ...dynamicCategories, ...dynamicServiceAreas, ...dynamicAttributes, ...dynamicServiceItems, ...dynamicFoodMenuItems, ...(includeCoreOnly ? CORE_ONLY_FIELDS : [])];
Static fields (profile, hours)
Dynamic fields (periods, context)
For each registry field:
Extract field values from snapshots
4d

#### Capability Resolution

route.ts
95
const capability = resolveFieldCapability({ config, coreValue, gbpValue });
4e
Import Capability Check
index.ts
147
let canImport = config.importable; if (canImport && (gbpValue === null || gbpValue === undefined)) { canImport = false; reasons.push('Google has no value to import.'); }
Check importable flag
Check exportable flag
Validate value presence
4f
Canonical Hash Computation
route.ts
100
const coreCanonicalHash = hashCanonicalJson(coreCanonical); const gbpCanonicalHash = hashCanonicalJson(gbpCanonical);
hashCanonicalJson(SHA-256)
Lookup field state from DB
4h

#### State Summary Response

route.ts
119
state: stateRow?.state ?? null, lastInSyncAt: stateRow?.lastInSyncAt ?? null
state, hashes, capabilities
open outbound candidates

## 5. Publish Decision Orchestration & Execution

Publish workflow from user decision submission through per-field orchestration, port execution (import/export), state transitions, and outbound candidate resolution in dual_sync_publish_operations table.

### Motivation

The publish decision orchestration solves the problem of safely synchronizing data between Nabatable's restaurant database and Google Business Profile when operators have reviewed field-level differences and chosen which direction to sync (import from Google or export to Nabatable).

The core challenge is drift protection: between the time an operator reviews field differences and clicks "Publish," either system could have changed. The orchestrator must detect these changes and reject stale decisions to prevent data loss [5a].

A secondary challenge is partial failure handling: if 10 fields are being synced and field 7 fails, the system must record exactly what succeeded, what failed, and why, so operators can retry individual failures without re-running the entire batch [5h].

### Details

#### Decision Submission

When a user clicks the "Publish" button in DualSyncShell, the UI collects all selected field decisions (import/export/ignore actions) along with pinned snapshot hashes for both Core and Google data [5a]. These hashes represent the exact state the operator reviewed. The mutation calls POST /dual-sync/publish with this payload [5b].

#### Validation & Authorization

The API route validates the decision schema (max 200 decisions per batch), ensures the user has admin access to the restaurant, and invokes the runPublish orchestrator with concrete ports that know how to execute imports and exports [5c].

#### Orchestration Loop

The orchestrator reads fresh Core and Google snapshots, builds the field registry, and processes decisions serially [5d]. For each decision:

Creates an operation row in dual_sync_publish_operations with status pending [5h]
Executes the port: applyImportToCore updates Nabatable tables, applyExportToGoogle calls Google's API with the appropriate update mask [5e]
Updates operation status to succeeded, failed, or skipped with before/after hashes and error details [5h]
Transitions field state: successful operations mark the field in_sync and update last_in_sync_hash; failures mark it import_failed or export_failed [5f]
Resolves outbound candidates: for exports, marks the corresponding dual_sync_outbound_candidates row as resolved [5g]

#### Batch Coalescing

The orchestrator detects consecutive same-section exports and offers them to section-specific batch ports (e.g., all 7 operating hours days can be pushed to Google in a single API call). This optimization reduces API calls while preserving per-field audit granularity.

#### Audit Trail

Every operation records before and after canonical hashes for both Core and Google values, the Google update mask used, external API responses, and error codes. This creates a complete audit trail in dual_sync_publish_operations that operators can review in the "Recent publishes" panel.

#### Final Recompute

After all decisions execute, the orchestrator runs a final recomputeAllStates pass to catch any residual drift that may have occurred during the publish job, ensuring the UI reflects the current reality.

Publish Decision Orchestration Flow
UI Layer (DualSyncShell)
onClickPublish handler
5a
Publish Mutation Trigger
DualSyncShell.tsx
310
const result = await publishMutation.mutateAsync({ decisions: payload, pinnedCoreSnapshotHash: stateData.coreSnapshotHash ?? null, pinnedGbpSnapshotHash: stateData.gbpSnapshotHash ?? null });
React Query Hook (useOpsDualSync)
5b
Publish Service Call
useOpsDualSync.ts
121
return publishDualSyncDecisions(restaurantId, request);
API Route (/dual-sync/publish)
Validate decisions schema
ensureRestaurantAdminAccess()
5c
Orchestrator Invocation
route.ts
73
const result = await runPublish(getServiceSupabaseClient(), { restaurantId, decisions: parsed.data.decisions, actorUserId: access.userId, pinnedCoreSnapshotHash: parsed.data.pinnedCoreSnapshotHash ?? null, pinnedGbpSnapshotHash: parsed.data.pinnedGbpSnapshotHash ?? null }, { ports: defaultDualSyncPorts() });
Orchestrator (runPublish)
Read Core & Google snapshots
Build registry & validate decisions
5d
Per-Field Orchestration
orchestrator.ts
1
// runPublish orchestrator loop
5h
Operation Audit Trail
operations.ts
1
// createOperation / updateOperationStatus
5e
Port Execution
ports.ts
1
// Port execution: applyImportToCore / applyExportToGoogle
applyImportToCore()
applyExportToGoogle()
5h
Operation Audit Trail
5f
State Transition
write.ts
1
// markInSync / markFailed state transitions
markInSync()
markFailed()
5g
Candidate Resolution
candidates.ts
1
// resolveOutboundCandidate
recomputeAllStates()
Database Tables
dual_sync_publish_operations
dual_sync_field_states
dual_sync_outbound_candidates

## 6. Database Schema - Dual-Sync Domain Tables

Persistent storage layer with four core tables: field_states for per-field sync state machine, snapshot_runs for transactional Google pulls, outbound_candidates for Core-side export queue, and publish_operations for audit trail.

### Motivation

The dual-sync database schema solves the problem of bidirectional synchronization between Nabatable's restaurant data and Google Business Profile. When a restaurant updates their hours in Nabatable, that change needs to be exported to Google. When Google's data changes (perhaps the restaurant updated it directly on Google), Nabatable needs to detect the drift and allow operators to import it. This requires tracking per-field sync state across hundreds of fields for each restaurant.

The core challenge: how do you know if a field is in sync, has drifted, or is in conflict when both systems changed? The schema provides a state machine [6a] that tracks 11 distinct states (in_sync, core_dirty, gbp_dirty, drifted, conflict, pending_import, pending_export, import_failed, export_failed, ignored, unsupported) with hash-based drift detection.

### Details

#### Field State Machine

The dual_sync_field_states table [6a] is the heart of the system. Each row represents one syncable field (like "restaurant name" or "Monday opening hours") for one restaurant. The unique constraint [6b] ensures exactly one state row per restaurant/provider/field combination, making the state machine deterministic.

The table stores:

Current state (one of 11 values)
Hash values for both Core and Google's canonical representations
Timestamps tracking when the field was last in sync, when Core changed it, when Google changed it
A reference to the snapshot run that last evaluated this field

#### Snapshot Tracking

The dual_sync_snapshot_runs table [6c] records every pull from Google Business Profile. Each run has a run_kind (manual refresh, scheduled cron, triggered by Core write, location link, or preflight check) and stores the complete canonical_snapshot as JSONB. This provides an audit trail: "At timestamp T, Google's data had hash X."

Field states reference these runs [6g] so you can answer questions like "when was this field last verified against Google?"

#### Export Queue

When Nabatable Core data changes (e.g., operator updates restaurant hours), the system creates a row in dual_sync_outbound_candidates [6d]. This is the export queue. Each candidate includes:

The proposed_value to export
A baseline_gbp_hash that pins the expected Google state (prevents overwriting newer Google changes)
Status tracking (open → resolved/superseded/cancelled)

The partial unique index [6e] enforces that only one open export candidate exists per field at a time, preventing duplicate queued exports.

#### Audit Trail

The dual_sync_publish_operations table [6f] records every import/export operation. When a publish job runs, it creates one operation row per field with:

Before/after hashes for both Core and Google
The google_update_mask used (e.g., "regularHours", "profile")
Error codes and external API responses for debugging failures
Status progression (pending → running → succeeded/failed/skipped)

This enables retry logic and provides complete observability into what changed when.

#### OAuth Connection Storage

Two tables from an earlier migration [6g, 6h] store the Google OAuth connection:

restaurant_external_profiles tracks connection status (unlinked → pending_auth → authorized → linked) and the selected Google location ID
restaurant_external_profile_credentials stores encrypted access tokens and refresh tokens needed to call Google's API

These tables are prerequisites for the dual-sync system to function.

Dual-Sync Database Schema (Migration 20260429210000)

#### Field State Machine

6a
Field States Table
20260429210000_add_unified_dual_sync_domain.sql
21
CREATE TABLE IF NOT EXISTS public.dual_sync_field_states (
Columns: restaurant_id, provider,
section_key, field_key, state
State values: in_sync, core_dirty,
gbp_dirty, drifted, conflict, etc.
6b
Field States Unique Constraint
20260429210000_add_unified_dual_sync_domain.sql
56
CREATE UNIQUE INDEX IF NOT EXISTS dual_sync_field_states_unique_field_idx ON public.dual_sync_field_states (restaurant_id, provider, field_key);
Foreign key to snapshot_runs

#### Snapshot Tracking

6c
Snapshot Runs Table
20260429210000_add_unified_dual_sync_domain.sql
75
CREATE TABLE IF NOT EXISTS public.dual_sync_snapshot_runs (
Columns: run_kind, status,
canonical_snapshot (jsonb)
Run kinds: manual, scheduled,
core_write, location_link
Referenced by field_states.last_snapshot_run_id

#### Export Queue

6d
Outbound Candidates Table
20260429210000_add_unified_dual_sync_domain.sql
123
CREATE TABLE IF NOT EXISTS public.dual_sync_outbound_candidates (
Columns: field_key, proposed_value,
baseline_gbp_hash, status
6e
One Open Candidate Constraint
20260429210000_add_unified_dual_sync_domain.sql
146
CREATE UNIQUE INDEX IF NOT EXISTS dual_sync_outbound_candidates_one_open_per_field_idx ON public.dual_sync_outbound_candidates (restaurant_id, provider, field_key) WHERE status = 'open';
Status: open, resolved, superseded

#### Audit Trail

6f
Publish Operations Table
20260429210000_add_unified_dual_sync_domain.sql
1
-- dual_sync_publish_operations table (defined later in migration)
OAuth Connection Storage (Migration 20260418101000)
6g
External Profiles Table
20260418101000_add_restaurant_business_profile_subsystem.sql
1
-- restaurant_external_profiles table
Columns: provider, external_account_id,
external_location_id, status
Status: unlinked, authorized, linked
6h
Credentials Table
20260418101000_add_restaurant_business_profile_subsystem.sql
1
-- restaurant_external_profile_credentials table
Encrypted: access_token, refresh_token
page.tsx
layout.tsx
OpsRestaurantSettingsClient.tsx
GoogleBusinessProfileSection.tsx
useOpsGoogleBusinessProfile.ts
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
import { OpsRestaurantSettingsClient } from '@/components/features/
restaurant-settings/OpsRestaurantSettingsClient';
import { RESTAURANT_SETTINGS_ROUTE_MAP } from '@/components/features/
restaurant-settings/routes';
import type { Metadata } from 'next';
const route = RESTAURANT_SETTINGS_ROUTE_MAP['google-business-profile'];
export const metadata: Metadata = {
title: `${route.title} · Nab a Table Ops`,
description: route.description,
};
export default function GoogleBusinessProfileSettingsPage() {
return &lt;OpsRestaurantSettingsClient view="google-business-profile" /&gt;;
}

## Capture Verification

- HTTP status from rendered browser navigation: 200
- Page title: Google Business Profile Settings Page - Dual-Sync Architecture
- All visible `See more` sections were expanded before capture.
- No Nabatable app code, routes, APIs, Supabase data, or runtime behavior was changed.

# Table Assignment & Capacity Business Rules

## Methodology & Verification

- Cross-referenced all findings across the latest Supabase migrations (e.g., `20251019102432_consolidated_schema.sql`, `20251028034500_assign_tables_atomic_v2_alias_fix.sql`, `20251103090500_enforce_booking_hours.sql`) and the generated `supabase/schema.sql` dump to confirm DDL parity.
- Extracted runtime policies from TypeScript sources under `server/capacity/**` and `server/feature-flags.ts`, validating line numbers with `nl -ba` and behaviour with duplicate `rg` searches.
- Applied redundant tooling (`rg`, `sed`, `nl`, schema cross-check) for every rule to satisfy the multi-angle verification requirement; discrepancies were documented in task notes.

---

## 1. Database Types & Table-Level Constraints

**Tables & Zones**

- Rule Description: Table attributes are restricted to enumerations—`table_category` (`bar`, `dining`, `lounge`, `patio`, `private`), `table_mobility` (`movable`, `fixed`), `table_seating_type` (`standard`, `sofa`, `booth`, `high_top`), and `table_status` (`available`, `reserved`, `occupied`, `out_of_service`).
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:153-194; supabase/schema.sql:358-392
  Rule Type: Hard Constraint
- Rule Description: Physical tables must have `min_party_size > 0` and, when present, `max_party_size ≥ min_party_size`.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:2333-2334; supabase/schema.sql:6053-6054
  Rule Type: Hard Constraint
- Rule Description: Each table is unique per restaurant by display number (`UNIQUE (restaurant_id, table_number)`).
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:2629-2631; supabase/schema.sql:7011-7016
  Rule Type: Hard Constraint
- Rule Description: Table capacity must come from the restaurant’s allowed capacity list, ensuring positive integers via FK to `allowed_capacities` (`capacity > 0`).
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:3277-3282,1687-1694; supabase/schema.sql:6322-6327,5988-5993
  Rule Type: Hard Constraint
- Rule Description: `table_inventory` defaults—status `available`, mobility `movable`, seating `standard`, and `active = true`—establish baseline operational state.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:2319-2331; supabase/schema.sql:6045-6052
  Rule Type: Policy
- Rule Description: Tables must belong to an existing zone and restaurant; deleting a restaurant cascades to its tables, while zones cannot be removed while tables reference them.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:3278-3288; supabase/schema.sql:6319-6339
  Rule Type: Hard Constraint
- Rule Description: Zone names must contain non-blank characters (`char_length(trim(name)) > 0`).
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:2368-2374; supabase/schema.sql:6101-6107
  Rule Type: Hard Constraint

**Adjacency & Merge Metadata**

- Rule Description: Adjacency pairs forbid self-links (`table_a <> table_b`) and are keyed by `(table_a, table_b)`.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:2304-2313,2620-2622; supabase/schema.sql:6034-6043
  Rule Type: Hard Constraint
- Rule Description: Table adjacency edges now persist exactly as authored; the database no longer auto-creates reverse pairs, so directionality is preserved unless clients insert both directions.
  Source: supabase/migrations/20251031162000_drop_table_adjacency_symmetry.sql:1-4; supabase/schema.sql (function removed at section 2537-2557)
  Rule Type: Workflow
- Rule Description: Merge group membership rows require tables to exist, share the same zone, and be mutually reachable via adjacency graph; violations raise exceptions.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:1569-1603; supabase/schema.sql:5856-5889
  Rule Type: Hard Constraint

**Capacity & Scheduling Tables**

- Rule Description: `allowed_capacities.capacity` must be positive and keyed by `(restaurant_id, capacity)`.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:1687-1694,2420-2421; supabase/schema.sql:5988-5994
  Rule Type: Hard Constraint
- Rule Description: `restaurant_capacity_rules` mandate non-negative `max_covers`/`max_parties` and require at least one scoping attribute (service period, day, or date).
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:2144-2162; supabase/schema.sql:6162-6179
  Rule Type: Hard Constraint
- Rule Description: `restaurant_operating_hours` rows must specify either `day_of_week` or `effective_date`, and open/close ordering is validated unless the venue is marked closed.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:2207-2222; supabase/schema.sql:6197-6214
  Rule Type: Hard Constraint
- Rule Description: `restaurant_service_periods` enforce `start_time < end_time` and restrict `booking_option` to `lunch`, `dinner`, or `drinks`.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:2226-2242; supabase/schema.sql:6221-6235
  Rule Type: Hard Constraint
- Rule Description: Restaurant-level reservation defaults constrain intervals (1–180 minutes) and default durations/buffers (15–300 minutes) with active flag default true.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:2244-2264; supabase/schema.sql:6241-6268
  Rule Type: Policy
- Rule Description: Service policy defaults lunches 12:00–15:00, dinners 17:00–22:00, clean buffer 5 minutes, and disallow after-hours by default.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:2275-2287; supabase/schema.sql:6274-6288
  Rule Type: Policy

**Allocations & Assignments**

- Rule Description: `allocations.resource_type` limited to `table` or `merge_group`; records capture booking/window per resource.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:1664-1679; supabase/schema.sql:5966-5985
  Rule Type: Hard Constraint
- Rule Description: Unique constraint `(booking_id, resource_type, resource_id)` prevents duplicate allocations for a resource-booking pair; GiST exclusion forbids overlapping windows per resource with deferrable enforcement.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:2404-2417; supabase/schema.sql:6608-6617
  Rule Type: Hard Constraint
- Rule Description: `booking_table_assignments` enforce unique `(booking_id, table_id)`, unique `(table_id, slot_id)`, and partial unique `(booking_id, idempotency_key)` when key present.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:2450-2456,2647-2652; supabase/migrations/20251027120000_add_unique_constraint_to_booking_table_assignments.sql:5-11; supabase/schema.sql:6647-6668,7023-7034
  Rule Type: Hard Constraint
- Rule Description: Assignment rows now store `start_at`/`end_at` timestamps for conflict checks.
  Source: supabase/schema.sql:5480-5493; cross-verified via inserts in supabase/migrations/20251028034500_assign_tables_atomic_v2_alias_fix.sql:255-360
  Rule Type: Hard Constraint
- Rule Description: Idempotency ledger (`booking_assignment_idempotency`) records `(booking_id, idempotency_key)` with table set and window; PK enforces one record per key.
  Source: supabase/migrations/20251026105000_assign_tables_atomic_v2.sql:13-40; supabase/schema.sql:5519-5539
  Rule Type: Workflow

**Hold Infrastructure**

- Rule Description: `table_holds` require `start_at < end_at`; cascade with restaurants/zones, and optional booking/creator FKs set to NULL on deletion.
  Source: supabase/migrations/20251026104700_add_table_holds.sql:12-78; supabase/schema.sql:5555-5616
  Rule Type: Hard Constraint
- Rule Description: `table_hold_members` enforce uniqueness per `(hold_id, table_id)` and ensure referenced tables persist (`ON DELETE RESTRICT`).
  Source: supabase/migrations/20251026104700_add_table_holds.sql:82-118; supabase/schema.sql:5618-5648
  Rule Type: Hard Constraint
- Rule Description: When strict conflicts are enabled, `table_hold_windows` materialises per-table ranges and excludes overlapping holds.
  Source: supabase/migrations/20251029183500_hold_windows_and_availability.sql:5-68; supabase/schema.sql:5699-5785
  Rule Type: Hard Constraint

---

## 2. Database Functions & Stored Workflows

**Adjacency & Merge Logic**

- Rule Description: `are_tables_connected(table_ids uuid[])` returns false for empty sets, true for single tables, and otherwise requires connected adjacency traversal.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:278-319; supabase/schema.sql:5328-5369
  Rule Type: Hard Constraint
- Rule Description: Runtime adjacency loading is responsible for mirroring edges when needed; the allocator consults `adjacency.queryUndirected` (default true) to decide whether to treat edges bidirectionally.
  Source: server/capacity/tables.ts:1433-1491; server/feature-flags.ts:134-137; supabase/migrations/20251031162000_drop_table_adjacency_symmetry.sql:1-4
  Rule Type: Workflow
- Rule Description: `validate_merge_group_members` blocks merge groups spanning multiple zones, referencing missing tables, or containing tables not mutually connected.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:1569-1603; supabase/schema.sql:5856-5889
  Rule Type: Hard Constraint

**Assignment Procedures**

- Rule Description: `assign_single_table` prohibits null table IDs before delegating to the atomic procedure with adjacency disabled.
  Source: supabase/migrations/20251103090400_refactor_assignment_procedures.sql:5-25; supabase/schema.sql:5379-5406
  Rule Type: Workflow
- Rule Description: `assign_merged_tables` demands at least two tables and honours the `p_require_adjacency` flag when forwarding to the core RPC.
  Source: supabase/migrations/20251103090400_refactor_assignment_procedures.sql:28-58; supabase/schema.sql:5408-5440
  Rule Type: Hard Constraint
- Rule Description: `assign_tables_atomic_v2` requires at least one valid table ID and deduplicates the input array.
  Source: supabase/migrations/20251028034500_assign_tables_atomic_v2_alias_fix.sql:24-46; supabase/schema.sql:5443-5466
  Rule Type: Hard Constraint
- Rule Description: Booking must exist; if custom window provided, both `p_start_at` and `p_end_at` are mandatory; otherwise, booking start/end (or date+time) must yield `start < end`.
  Source: supabase/migrations/20251028034500_assign_tables_atomic_v2_alias_fix.sql:47-115; supabase/schema.sql:5467-5535
  Rule Type: Hard Constraint
- Rule Description: All requested tables must belong to the booking’s restaurant, have non-null zones, be marked `active`, and when multiple tables are involved they must share the same zone and be `movable`.
  Source: supabase/migrations/20251028034500_assign_tables_atomic_v2_alias_fix.sql:117-171; supabase/schema.sql:5536-5590
  Rule Type: Hard Constraint
- Rule Description: When adjacency enforcement is requested, every table must have at least one adjacency edge to another selected table; lack of connectivity raises an error.
  Source: supabase/migrations/20251028034500_assign_tables_atomic_v2_alias_fix.sql:172-199; supabase/schema.sql:5591-5621
  Rule Type: Hard Constraint
- Rule Description: Procedure acquires a zone+service-date advisory transaction lock to serialize assignments per zone/day.
  Source: supabase/migrations/20251028034500_assign_tables_atomic_v2_alias_fix.sql:201-210; supabase/schema.sql:5622-5632
  Rule Type: Workflow
- Rule Description: Idempotency keys are validated—reuse with a different table set raises `P0003`; matching keys return prior assignments without re-writing.
  Source: supabase/migrations/20251028034500_assign_tables_atomic_v2_alias_fix.sql:212-246; supabase/schema.sql:5633-5667
  Rule Type: Hard Constraint
- Rule Description: Assignments are blocked when active holds (not owned by the booking) overlap the requested window; conflict details reference hold ID.
  Source: supabase/migrations/20251028034500_assign_tables_atomic_v2_alias_fix.sql:248-270; supabase/schema.sql:5668-5689
  Rule Type: Hard Constraint
- Rule Description: Slot rows are lazily created or retrieved when bookings carry `booking_date` + `start_time`, ensuring slot linkage.
  Source: supabase/migrations/20251028034500_assign_tables_atomic_v2_alias_fix.sql:272-290; supabase/schema.sql:5690-5708
  Rule Type: Workflow
- Rule Description: Multi-table assignments provision a shared `allocations` row of type `merge_group`; exclusion violations (overlapping window) abort with `allocations_no_overlap`.
  Source: supabase/migrations/20251028034500_assign_tables_atomic_v2_alias_fix.sql:292-330; supabase/schema.sql:5709-5748
  Rule Type: Hard Constraint
- Rule Description: Existing overlapping table assignments for other bookings trigger `P0001` with detailed conflict context.
  Source: supabase/migrations/20251028034500_assign_tables_atomic_v2_alias_fix.sql:332-359; supabase/schema.sql:5749-5784
  Rule Type: Hard Constraint
- Rule Description: Upserts into `booking_table_assignments` update timestamps, idempotency keys, merge group IDs, slots, and start/end clocks; failure to locate existing rows raises duplicate exception.
  Source: supabase/migrations/20251028034500_assign_tables_atomic_v2_alias_fix.sql:360-418; supabase/schema.sql:5785-5856
  Rule Type: Workflow
- Rule Description: `allocations` per table are inserted/upserted; exclusion violations bubble as `allocations_no_overlap` errors.
  Source: supabase/migrations/20251028034500_assign_tables_atomic_v2_alias_fix.sql:419-456; supabase/schema.sql:5857-5904
  Rule Type: Hard Constraint
- Rule Description: After each assignment, `refresh_table_status` is invoked to set floor status accurately; idempotency ledger is written last when key supplied.
  Source: supabase/migrations/20251028034500_assign_tables_atomic_v2_alias_fix.sql:457-493; supabase/schema.sql:5905-5956
  Rule Type: Workflow

**Hold Enforcement**

- Rule Description: `is_holds_strict_conflicts_enabled()` reads `app.holds.strict_conflicts.enabled`; toggled via `set_hold_conflict_enforcement(boolean)`.
  Source: supabase/migrations/20251029183500_hold_windows_and_availability.sql:70-117; supabase/schema.sql:5787-5836
  Rule Type: Policy
- Rule Description: Triggers keep `table_hold_windows` synchronized—insert/delete on members copy hold metadata, while hold updates propagate timings when strict mode is on.
  Source: supabase/migrations/20251029183500_hold_windows_and_availability.sql:119-208; supabase/schema.sql:5838-5958
  Rule Type: Workflow

**Status & Availability Utilities**

- Rule Description: `refresh_table_status` prioritises maintenance holds, then checked-in bookings, then future reservations; absence of allocations resets status to `available`.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:1229-1294; supabase/schema.sql:6116-6184
  Rule Type: Workflow
- Rule Description: Triggers on `allocations` and booking status updates invoke `refresh_table_status` after insert/update/delete to keep inventory current.
  Source: supabase/migrations/20251019102432_consolidated_schema.sql:1160-1228; supabase/schema.sql:6069-6114
  Rule Type: Workflow
- Rule Description: `is_table_available_v2` returns false when a requested range intersects assignments for statuses `pending`, `confirmed`, or `checked_in`, unless evaluating the same booking.
  Source: supabase/migrations/20251029183500_hold_windows_and_availability.sql:144-200; supabase/schema.sql:5959-6031
  Rule Type: Hard Constraint

**Capacity-Aware Booking Creation**

- Rule Description: `create_booking_with_capacity_check` validates operating hours—when `service_policy.allow_after_hours` is false it rejects bookings outside configured open intervals or on closures.
  Source: supabase/migrations/20251103090500_enforce_booking_hours.sql:36-146; supabase/schema.sql:7075-7228
  Rule Type: Hard Constraint
- Rule Description: Capacity rules are locked (`FOR UPDATE NOWAIT`) and determine `max_covers` / `max_parties`; bookings exceeding either limit return structured `CAPACITY_EXCEEDED` errors.
  Source: supabase/migrations/20251103090500_enforce_booking_hours.sql:148-214; supabase/schema.sql:7229-7324
  Rule Type: Hard Constraint
- Rule Description: Booking counts exclude `cancelled` and `no_show` statuses when evaluating utilisation.
  Source: supabase/migrations/20251103090500_enforce_booking_hours.sql:181-202; supabase/schema.sql:7261-7286
  Rule Type: Policy

---

## 3. Application Logic — `server/capacity/tables.ts`

**Booking Window Computation**

- Rule Description: `computeBookingWindow` derives dining and block ranges using venue policy turn bands and buffers; throws `ServiceOverrunError` if the buffered block exceeds service end.
  Source: server/capacity/tables.ts:364-403; policy defaults in server/capacity/policy.ts:80-109
  Rule Type: Hard Constraint
- Rule Description: `computeBookingWindowWithFallback` retries using the first configured service when no service matches and `allocator.service.failHard` is false; otherwise it propagates the error.
  Source: server/capacity/tables.ts:418-471; server/feature-flags.ts:99-103
  Rule Type: Policy
- Rule Description: `resolveStartDateTime` rejects invalid ISO/times by raising `ManualSelectionInputError("INVALID_START")`.
  Source: server/capacity/tables.ts:472-515
  Rule Type: Hard Constraint

**Table Candidate Filtering**

- Rule Description: `filterTimeAvailableTables` (strict mode) removes tables whose availability bitset conflicts with the requested block window.
  Source: server/capacity/tables.ts:868-908
  Rule Type: Hard Constraint
- Rule Description: `filterAvailableTables` excludes tables that are avoided, outside the requested zone, inactive, marked `out_of_service`, have non-positive capacity, are below party size (unless `allowInsufficientCapacity`), or violate min/max party limits.
  Source: server/capacity/tables.ts:912-938
  Rule Type: Hard Constraint
- Rule Description: When adjacency is mandated for the party size, the function seeds missing adjacency entries to ensure subsequent adjacency checks run.
  Source: server/capacity/tables.ts:939-943
  Rule Type: Workflow

**Adjacency Requirements**

- Rule Description: `partiesRequireAdjacency` honours `allocator.requireAdjacency` and optional `allocator.adjacencyMinPartySize`; adjacency only enforced when flags demand it.
  Source: server/capacity/tables.ts:960-975; server/feature-flags.ts:95-112
  Rule Type: Policy
- Rule Description: `resolveRequireAdjacency` prioritises explicit overrides from callers before falling back to allocator policy.
  Source: server/capacity/tables.ts:977-988
  Rule Type: Policy

**Lookahead & Demand Protection**

- Rule Description: `prepareLookaheadBookings` considers only future bookings without table assignments, with positive party sizes, whose computed blocks start after the current booking and within the lookahead window.
  Source: server/capacity/tables.ts:1005-1076
  Rule Type: Workflow
- Rule Description: `applyLookaheadPenalties` penalises plans that would starve future bookings of any feasible table plan, adding `penaltyWeight` per impacted booking and recording conflicts.
  Source: server/capacity/tables.ts:1080-1166; server/feature-flags.ts:36-45
  Rule Type: Soft Constraint / Preference

**Manual Selection & Holds**

- Rule Description: Manual selection requires at least one table ID; missing selections throw `ManualSelectionInputError("TABLES_REQUIRED")`.
  Source: server/capacity/tables.ts:1874-1883
  Rule Type: Hard Constraint
- Rule Description: Selected tables must all exist; lookup mismatches raise `ManualSelectionInputError("TABLE_LOOKUP_FAILED")`.
  Source: server/capacity/tables.ts:1899-1907
  Rule Type: Hard Constraint
- Rule Description: Manual validation enforces: combined capacity ≥ party size, single-zone membership, all tables movable when merging, adjacency when required, absence of booking/hold conflicts, and reports holds blocking selection.
  Source: server/capacity/tables.ts:1760-1866
  Rule Type: Hard Constraint
- Rule Description: Hold creation defaults to 180-second TTL, unless overridden, and requires zone resolution; failure emits `ManualSelectionInputError("ZONE_REQUIRED")`.
  Source: server/capacity/tables.ts:74,1988-2032
  Rule Type: Policy
- Rule Description: Replaced holds are released with retry/backoff logic to avoid leaking stale holds.
  Source: server/capacity/tables.ts:2058-2079,119-138
  Rule Type: Workflow

---

## 4. Application Logic — `server/capacity/selector.ts`

**Candidate Eligibility**

- Rule Description: Tables with non-positive capacity, party-size mismatch (below min or above max), or capacity exceeding `partySize + maxOverage` are removed before planning.
  Source: server/capacity/selector.ts:185-205
  Rule Type: Hard Constraint
- Rule Description: Maximum tables considered per plan is the minimum of feature flag `allocator.kMax`, config `maxTables`, and available table count; evaluation and per-slack limits default to 500 and 50 unless overridden.
  Source: server/capacity/selector.ts:161-166; server/feature-flags.ts:104-127
  Rule Type: Policy

**Combination Enumeration**

- Rule Description: DFS enumeration stops when evaluation limit is reached, recording skip reason `limit`.
  Source: server/capacity/selector.ts:675-683
  Rule Type: Policy
- Rule Description: Combinations exceeding `kMax` slots or failing to achieve party size even with remaining capacity (`capacity_upper_bound`) are pruned.
  Source: server/capacity/selector.ts:686-706
  Rule Type: Hard Constraint
- Rule Description: When adjacency is required, only frontier-adjacent tables may join the combination; non-adjacent candidates are skipped.
  Source: server/capacity/selector.ts:720-747
  Rule Type: Hard Constraint
- Rule Description: Mixed-zone combinations are disallowed once a base zone is established.
  Source: server/capacity/selector.ts:724-727
  Rule Type: Hard Constraint
- Rule Description: Plans exceeding maximum allowed capacity are skipped early to avoid exploring dominated branches.
  Source: server/capacity/selector.ts:734-739
  Rule Type: Hard Constraint
- Rule Description: Per-slack bucket limit retains only the best `bucketLimit` plans per slack value, pruning the rest with skip reason `bucket`.
  Source: server/capacity/selector.ts:600-618
  Rule Type: Policy

**Scoring & Metrics**

- Rule Description: Candidate metrics compute slack (overage), fragmentation, zone dispersion, adjacency depth, and scarcity sum for each plan.
  Source: server/capacity/selector.ts:323-350
  Rule Type: Workflow
- Rule Description: Score formula = slack penalty × demand multiplier + combination penalties (tableCount + adjacency) + fragmentation + zone balance + scarcity penalty; higher scores are worse.
  Source: server/capacity/selector.ts:353-379
  Rule Type: Soft Constraint / Preference
- Rule Description: Combination penalty is amplified (capped at 3×) when average scarcity is high, discouraging use of rare tables in merges.
  Source: server/capacity/selector.ts:366-374
  Rule Type: Soft Constraint / Preference
- Rule Description: Plans are sorted by score, then overage, table count, total capacity, fragmentation, adjacency cost, and lexicographic table key.
  Source: server/capacity/selector.ts:380-408
  Rule Type: Workflow
- Rule Description: Table-level scarcity fallback assigns score `1 / countWithinType` when no precalculated metric exists.
  Source: server/capacity/selector.ts:433-457
  Rule Type: Policy

**Diagnostics & Perf Safeguards**

- Rule Description: Performance warnings log when plan generation exceeds 500 ms, capturing diagnostics for observability.
  Source: server/capacity/selector.ts:286-314
  Rule Type: Workflow

---

## 5. Policies, Demand Profiles & Strategic Config

**Venue Policy Defaults**

- Rule Description: Default service order is lunch then dinner; buffers are 0 minutes pre and 5 minutes post; turn bands define durations based on party size (e.g., dinner party size >6 gets 85–90 minutes).
  Source: server/capacity/policy.ts:80-123
  Rule Type: Policy
- Rule Description: Selector scoring weights default to overage 5, tableCount 3, fragmentation 2, zoneBalance 4, adjacencyCost 1, scarcity weight from strategic config; max overage = 2 seats, max tables = 3.
  Source: server/capacity/policy.ts:113-135
  Rule Type: Policy

**Strategic Config & Scarcity**

- Rule Description: Dynamic scarcity weight defaults to 22, clamped between 0 and 1000; cached for 30 seconds per restaurant (`GLOBAL_CACHE_KEY`).
  Source: server/capacity/strategic-config.ts:13-112,168-214
  Rule Type: Policy
- Rule Description: Strategic overrides load from DB (`strategic_configs`) when available; missing tables/columns gracefully fall back to env defaults and log warnings.
  Source: server/capacity/strategic-config.ts:140-188
  Rule Type: Workflow
- Rule Description: Scarcity metrics cache per restaurant for five minutes; missing metrics trigger heuristic fallback `computeScarcityScore`.
  Source: server/capacity/scarcity.ts:7-108
  Rule Type: Policy
- Rule Description: Table type identity for scarcity scoring is derived from capacity, normalized category, and seating type.
  Source: server/capacity/scarcity.ts:25-37
  Rule Type: Workflow

**Demand Profiles & Yield Management**

- Rule Description: Demand multipliers prioritise DB-configured rules; failing that, defaults apply via `config/demand-profiles.json` (weekday lunch 0.85, weekday dinner 1.15, Fri/Sat dinner 1.35, weekend brunch 1.1).
  Source: server/capacity/demand-profiles.ts:111-207,423-486; config/demand-profiles.json:1-33
  Rule Type: Policy
- Rule Description: Fallback parsing tolerates malformed times by defaulting to full-day windows, sorts rules by priority, and caches multiplier decisions for five minutes by `(restaurantId, day, window, minuteOfDay)`.
  Source: server/capacity/demand-profiles.ts:36-220,362-421
  Rule Type: Workflow

---

## 6. Feature Flags & Runtime Toggles (`server/feature-flags.ts`)

- Rule Description: `allocator.requireAdjacency` (default true) and `allocator.adjacencyMinPartySize` determine when adjacency enforcement applies.
  Source: server/feature-flags.ts:95-112
  Rule Type: Policy
- Rule Description: `allocator.kMax` (default 3, clamped 1–5) caps tables per plan; `selector.maxPlansPerSlack` and `selector.maxCombinationEvaluations` optionally tighten planner breadth.
  Source: server/feature-flags.ts:104-127
  Rule Type: Policy
- Rule Description: `allocator.service.failHard` (default false, overrideable) decides whether service fallback is allowed when computing booking windows.
  Source: server/feature-flags.ts:99-103
  Rule Type: Policy
- Rule Description: `allocator.mergesEnabled` defaults to true outside production, gating multi-table assignment features.
  Source: server/feature-flags.ts:64-70
  Rule Type: Policy
- Rule Description: `selectorScoring`, `selectorLookahead.enabled`, and `combinationPlanner` toggle scoring, lookahead penalties, and combination planning respectively; lookahead window defaults to 120 minutes with penalty weight 500.
  Source: server/feature-flags.ts:32-50
  Rule Type: Policy
- Rule Description: `planner.time_pruning.enabled` determines whether time-based pruning executes in `filterTimeAvailableTables`.
  Source: server/feature-flags.ts:72-75; server/capacity/tables.ts:812-908
  Rule Type: Policy
- Rule Description: `holds.enabled` (default true) and `holds.strictConflicts` (default false, overrideable via GUC) govern hold lifecycle and enforcement mode.
  Source: server/feature-flags.ts:64-66,129-133; supabase/migrations/20251029183500_hold_windows_and_availability.sql:70-208
  Rule Type: Policy
- Rule Description: `adjacency.queryUndirected` (default true) shapes adjacency graph queries; when disabled, directed adjacency must be respected.
  Source: server/feature-flags.ts:134-137
  Rule Type: Policy
- Rule Description: `allocatorV2.forceLegacy`, `allocatorV2.enabled`, and `allocatorV2.shadow` orchestrate rollout of allocator V2 behaviour.
  Source: server/feature-flags.ts:77-93
  Rule Type: Policy
- Rule Description: `opsMetrics` and `opsRejectionAnalytics` flags gate operational telemetry, influencing diagnostics the allocator emits.
  Source: server/feature-flags.ts:56-62
  Rule Type: Policy

---

## 7. Observed Risk & Ambiguity Notes

- Hold overlap enforcement relies on `holds.strictConflicts`; leaving it disabled reverts to application-level checks, increasing race-condition risk around holds.
- Service fallback depends on `allocator.service.failHard`; ensure policy aligns with venue expectations to avoid silent shifts between services.
- Scarcity heuristics assume consistent table categorisation; mislabelled tables can dilute scarcity penalties.
- Strategic config caching (30 seconds) and demand multiplier cache (5 minutes) introduce short staleness windows after administrative changes.

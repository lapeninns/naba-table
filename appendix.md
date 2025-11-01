Algorithm & Logic Appendix (implementation-ready)
Problem

For a booking q = {zoneId, partySize S, startAt, endAt} choose a set of tables A such that:

All tables are in zoneId and active.

If |A| > 1, all are movable (merges only use movable).

No table in A is overlapping an allocation/hold within [start−buffer, end+buffer).

Total capacity Σ cap(A) ≥ S.

Objective (lexicographic)

Fewest tables |A|.

Least overage Σ cap(A) − S.

Preserve scarce sizes (lower scarcity_cost wins).

Prefer adjacency (higher adj_score wins).

Deterministic tie-break by sorted table IDs.

Data rules & guards (where enforced)

Zone & active check: selector + RPC v2.

Movable-only merges: selector + RPC v2 (k>1 ⇒ movable).

Adjacency: selector filters to connected combos when requireAdjacency=true; RPC can re-check if flag on.

Overlap: preview via bitset (selector), authoritative via GiST exclusion in allocations at RPC.

Blocking window: [startAt − buffer, endAt + buffer); default buffer 15 min.

Holds: mirrored into allocations as resource_type='hold' so they block other previews/assigns.

Scoring terms

k = |A|

overage = Σcap(A) − S (>=0)

adj_score = number of edges inside A from table_adjacencies

scarcity_cost(A) = Σ weight[size] \* count_of_size_in_A, where
weight[size] = 1 + (max_count / count(size)) computed per zone from table_inventory.

Final score (minimize lexicographically):

score(A) = ( k,
overage,
scarcity_cost(A),
-adj_score,
ids_tuple(A) )

Selector (server/capacity/selector.ts)
Inputs

booking (zoneId, S, startAt, endAt)

options: maxTables (default 3), requireAdjacency, avoidTables[]

layout: movable/fixed, adjacency graph, active flags

availability: bitset per table for the requested window (dry-run)

Flow

Build window bit-mask W for [start−buffer, end+buffer).

Filter candidates in zoneId, active, not in avoidTables, and free(t) := (busy_bits[t] & W) == 0 (holds + allocations considered).

Single table fast-path: pick smallest single t s.t. cap(t) ≥ S.

Merge catalog:

Enumerate combos of movable tables up to kMax (=3).

If requireAdjacency, only keep combos forming a connected subgraph in table_adjacencies.

Drop dominated combos (same or more tables, same or more capacity, same or worse adjacency that is a superset).

Score each feasible combo with score(A) and pick min.

Return candidate + alternates (next best 2–3), plus nextTimes (shifted +15/+30/+45 min that clear conflicts).

Pseudocode (selector)
export function getCandidates(booking, opts): CandidateSet {
const W = makeMask(booking.startAt, booking.endAt, buffer);
const inZone = tables.filter(t => t.zoneId === booking.zoneId && t.active && !opts.avoid.has(t.id));
const free = inZone.filter(t => isFree(t.id, W));

// singles
const singles = free.filter(t => t.capacity >= S).sort(byCapacityThenId);
if (singles.length) pushCandidate([singles[0]], reason("single"));

// merges
const mov = free.filter(t => t.movable);
const combos = buildCombos(mov, opts.kMax, opts.requireAdjacency); // k=2..3
for (const A of combos) {
if (sumCap(A) < S) continue;
const sc = scarcityCost(A, weights);
const score = [A.length, sumCap(A)-S, sc, -adjScore(A), idsTuple(A)];
pushCandidate(A, score, reason("merge"));
}

return rankAndTrim(); // top 1 + alternates + nextTimes
}

Holds & Auto Quote (quote/confirm)
Quote (staff/auto/quote)

Runs selector to produce candidate/alternates.

Creates a hold:

Insert into table_holds + table_hold_members.

Mirror hold into allocations with same window → prevents other previews/assigns.

TTL ~120s (expires_at) with periodic sweeper.

Response returns {holdId, expiresAt, candidate, alternates, nextTimes}.

Confirm (staff/auto/confirm)

Reads hold → RPC v2 with table_ids from hold.

RPC v2 re-validates (zone, movable, adjacency if flag, overlaps via GiST).

On success, hold rows + mirror allocations are deleted in the same commit.

Writes booking_table_assignments (multi rows) and allocations (type table, and optional merge_group).

Manual Assign
Manual Hold (staff/manual/hold)

From the floor plan selection, create/update a selection hold (same mirror-to-allocations rule).

Respond with k, capacity, overage and any soft warnings.

Manual Validate (staff/manual/validate)

Stateless check returning:

sameZone

movableForMerge (if k>1)

adjacency (if flag on, ok=true/false; if off, provide info as warning)

conflict (dry-run free check using bitset)

capacityEnough (Σcap ≥ S)

Manual Confirm (staff/manual/confirm)

Same call path as Auto Confirm → RPC v2 → enforce rules → persist → cleanup holds.

RPC v2 core checks (assign_tables_atomic_v2)

Inside a single transaction under a per-zone advisory lock:

Retrieve booking [startAt, endAt], compute buffer-expanded window.

Table checks: same zone, active.

Merge rule: if k>1, all movable=true.

Adjacency (when flag on): selection must be connected in table_adjacencies.

Overlap: insert into allocations (type table) — GiST exclusion prevents conflicts.

(Optional) Insert single allocations row for merge_group.

Insert booking_table_assignments rows (set merge_group_id if used).

Write audit_logs.

Idempotency: upsert on (booking_id, idempotency_key) or detect existing assignments and return them.

On conflict (GiST or lock timeout) → rollback and return CONFLICT_RETRY.

Bitset availability (server/capacity/planner/bitset.ts)

Slot = 5 minutes; window mask covers [start−buffer, end+buffer).

Table is free if (busy_bits[table] & W) == 0.

For preview, OR in allocations and holds to form busy_bits.

For persistence, RPC is authoritative (GiST).

Acceptance tests the team should implement

Singles over merges: if a single fits, selector never returns a merge.

Fewest tables precedes least overage (prove with counter examples).

Adjacency on filters to connected merges only; off just scores adjacency.

Scarcity: when two plans tie on (k, overage), the one using rarer sizes loses.

NextTimes: if candidate conflicts, the +15 min shift yields a valid plan for typical layouts.

RPC enforcement: attempting to confirm a non-movable pair (k>1) fails with POLICY.

Overlap: two overlapping confirms on the same table → one succeeds, one CONFLICT_RETRY.

Manual validate: selecting cross-zone or insufficient capacity returns ok=false with correct checks[].

Where to put what (files)

Selector: server/capacity/selector.ts (combos, scoring, alternates, nextTimes)
Feature flags: enable `FEATURE_COMBINATION_PLANNER` whenever `FEATURE_ALLOCATOR_MERGES_ENABLED` is true; otherwise merges remain supported but no multi-table plan can be produced.

Bitset: server/capacity/planner/bitset.ts (mask & free checks)

Holds service: server/capacity/holds.ts (create/update/expire/mirror)

Persistence client: server/capacity/tables.ts (quoteAuto, confirmAuto, manual variants)

RPC v2: supabase/migrations/…\_assign_tables_atomic_v2.sql

APIs:

src/app/api/staff/auto/quote/route.ts

src/app/api/staff/auto/confirm/route.ts

src/app/api/staff/manual/hold/route.ts

src/app/api/staff/manual/validate/route.ts

src/app/api/staff/manual/confirm/route.ts

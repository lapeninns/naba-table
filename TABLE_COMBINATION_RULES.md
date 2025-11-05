# Table Combination Rules & Validation Summary

## Question

**"Any movable tables can be merged within the zone? Is the validation don't have the rules?"**

## Answer: YES, with specific rules! ✅

The system **DOES have comprehensive validation rules** for table combinations/merging. Here's how it works:

---

## 🔧 Core Rules for Table Combinations

### 1. **SAME ZONE Requirement** ✅

- **Rule**: All tables in a combination **MUST** be in the same zone
- **Code**: `server/capacity/selector.ts:807`
  ```typescript
  if (selection.length > 0 && baseZoneId && candidate.zoneId && candidate.zoneId !== baseZoneId) {
    incrementCounter(diagnostics.skipped, 'zone');
    continue; // Reject cross-zone combinations
  }
  ```
- **Manual Assignment**: `server/capacity/tables.ts:1853`
  ```typescript
  message: 'Tables must belong to the same zone for manual assignment';
  ```

### 2. **MOVABLE Requirement** ✅

- **Rule**: For multi-table assignments, **ALL tables MUST be movable**
- **Code**: `server/capacity/tables.ts:1864`
  ```typescript
  const allMovable = tables.every((table) => table.mobility === 'movable');
  checks.push({
    id: 'movable',
    status: allMovable ? 'ok' : 'error',
    message: allMovable ? 'All tables are movable' : 'Merged assignments require movable tables',
  });
  ```
- **Fixed tables** (mobility="fixed") **CANNOT** be combined with other tables

### 3. **ADJACENCY Requirement** ⚠️

- **Rule**: Tables MUST be physically adjacent (when adjacency is enforced)
- **Code**: `server/capacity/selector.ts:804` & `tables.ts:1893`
  ```typescript
  if (requireAdjacency && frontier && !frontier.has(candidate.id)) {
    continue; // Reject non-adjacent tables
  }
  ```
- **When Enforced**:
  - Controlled by `FEATURE_ALLOCATOR_REQUIRE_ADJACENCY` (default: `true`)
  - Can set minimum party size: `FEATURE_ALLOCATOR_ADJACENCY_MIN_PARTY_SIZE`
  - For example: Only enforce adjacency for parties of 5+

- **Current Issue**: ❌ **NO adjacency data exists in the database**
  - `table_adjacencies` table is **EMPTY** (0 relationships out of 780 possible)
  - This is why table combinations aren't working despite feature being enabled

### 4. **K-MAX Limit** ✅

- **Rule**: Maximum number of tables that can be combined
- **Default**: 3 tables maximum
- **Code**: `server/feature-flags.ts:117`
  ```typescript
  export function getAllocatorKMax(): number {
    const configured = env.featureFlags.allocator.kMax ?? 3;
    return Math.max(1, Math.min(configured, 5)); // Capped at 5
  }
  ```
- **Your Config**: `.env.local` sets `FEATURE_ALLOCATOR_K_MAX=3`

### 5. **CAPACITY Limits** ✅

- **Rule**: Total capacity cannot exceed party size + allowed overage
- **Code**: `server/capacity/selector.ts:817`
  ```typescript
  const nextCapacity = runningCapacity + (candidate.capacity ?? 0);
  if (nextCapacity > maxAllowedCapacity) {
    incrementCounter(diagnostics.skipped, 'overage');
    break; // Reject over-capacity combinations
  }
  ```

---

## 📊 Validation Checks Summary

| Check ID      | What It Validates                  | Status if Failed                           |
| ------------- | ---------------------------------- | ------------------------------------------ |
| **zone**      | All tables in same zone            | ❌ ERROR - blocks assignment               |
| **movable**   | All tables are movable (not fixed) | ❌ ERROR - blocks assignment               |
| **adjacency** | Tables are physically adjacent     | ❌ ERROR - blocks assignment (if enforced) |
| **capacity**  | Total capacity within limits       | ⚠️ SKIPPED - combination rejected          |
| **kmax**      | Number of tables ≤ k-max           | ⚠️ SKIPPED - combination rejected          |

---

## 🎯 Current State Analysis

### Feature Flags Status

✅ **ENABLED**:

- `FEATURE_COMBINATION_PLANNER=true`
- `FEATURE_ALLOCATOR_MERGES_ENABLED=true`
- `FEATURE_ALLOCATOR_K_MAX=3`
- `FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS=1000`
- `isCombinationPlannerEnabled() = true` ✓

### Database State

❌ **BLOCKING ISSUE**:

- **40 tables** in restaurant
- **0 adjacency relationships** defined in `table_adjacencies` table
- **780 possible relationships** (40 × 39 / 2)
- **Coverage: 0%**

### Why Combinations Aren't Working

1. ✅ Feature flag is enabled
2. ✅ Validation rules are in place
3. ❌ **NO adjacency data exists**
4. ❌ **Algorithm requires adjacency to combine tables safely**

---

## 🔑 Adjacency Logic

The algorithm uses a **frontier-based search** to ensure tables are connected:

```typescript
// Build frontier: tables adjacent to current selection
const buildFrontier = (selectionIds: Set<string>): Set<string> => {
  const frontierIds = new Set<string>();
  for (const id of selectionIds) {
    const neighbors = adjacency.get(id); // ← Looks up adjacencies
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (!selectionIds.has(neighbor) && candidateLookup.has(neighbor)) {
        frontierIds.add(neighbor);
      }
    }
  }
  return frontierIds;
};

// Only allow adding tables from the frontier
if (requireAdjacency && frontier && !frontier.has(candidate.id)) {
  continue; // Reject this combination
}
```

**Without adjacency data**: The frontier is always empty → no combinations possible.

---

## 🚀 Solution: Populate Adjacency Data

### Option 1: Allow Non-Adjacent Combinations (Testing Only)

Disable adjacency requirement:

```bash
# Add to .env.local
FEATURE_ALLOCATOR_REQUIRE_ADJACENCY=false
```

⚠️ **Not recommended for production** - tables might be on opposite sides of the restaurant!

### Option 2: Populate Adjacency Table (Recommended)

Define which tables are physically next to each other:

```sql
-- Example: Define adjacencies for Prince of Wales Pub
INSERT INTO table_adjacencies (restaurant_id, table1_id, table2_id)
VALUES
  -- Zone: bar (high-top tables)
  ('0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a', '<table-1-id>', '<table-2-id>'),
  ('0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a', '<table-2-id>', '<table-3-id>'),

  -- Zone: dining (standard tables)
  ('0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a', '<table-4-id>', '<table-5-id>'),
  -- ... etc
;
```

**Benefits**:

- Safe table combinations (only adjacent tables)
- Better customer experience (tables next to each other)
- Zone-aware (bar tables with bar, dining with dining)
- Respects floor plan layout

---

## 📋 Example: How It Works

### Scenario: Party of 7, Tables Available

- Table A: capacity 4, zone=dining, movable, adjacent to B
- Table B: capacity 4, zone=dining, movable, adjacent to A
- Table C: capacity 8, zone=dining, fixed

### Algorithm Evaluation

**Option 1**: Table A + B

- ✅ Same zone (dining)
- ✅ Both movable
- ✅ Adjacent (defined in table_adjacencies)
- ✅ Total capacity: 8 (within limits for party of 7)
- ✅ k-max: 2 tables (≤ 3)
- **Result**: ✅ VALID combination

**Option 2**: Table C alone

- ✅ Single table (no combination rules apply)
- ❌ Fixed (cannot be moved/combined)
- **Result**: ✅ VALID but less optimal (wastes 1 seat)

**Option 3**: Table A + C

- ✅ Same zone
- ❌ Table C is fixed (not movable)
- **Result**: ❌ REJECTED - "Merged assignments require movable tables"

**Option 4**: Table A + Table D (in patio zone)

- ❌ Different zones (dining vs patio)
- **Result**: ❌ REJECTED - "Tables must belong to the same zone"

---

## 🎬 Next Steps

1. **For Testing**: Disable adjacency requirement temporarily

   ```bash
   echo "FEATURE_ALLOCATOR_REQUIRE_ADJACENCY=false" >> .env.local
   ```

2. **For Production**: Populate adjacency data
   - Create script to define table adjacencies
   - Based on actual floor plan
   - Group by zones (bar, dining, patio, private, lounge)

3. **Verify**: Re-run auto-assignment and check for combinations
   ```bash
   pnpm tsx -r tsconfig-paths/register scripts/check-table-combinations.ts
   ```

Would you like me to create a script to:

- **A)** Disable adjacency temporarily for testing?
- **B)** Generate sample adjacency data based on zones?
- **C)** Both?
